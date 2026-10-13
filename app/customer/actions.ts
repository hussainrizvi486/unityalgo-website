'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import type { VerificationPurpose } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { CommentEntityType, createComment } from '@/lib/comments';
import {
    verifyCustomerSessionToken,
    CUSTOMER_SESSION_COOKIE,
    CUSTOMER_SESSION_DURATION_SECONDS,
    signPendingEmailToken,
    signVerifiedEmailToken,
    signResetPendingToken,
    signResetVerifiedToken,
    verifyRegToken,
    verifyResetToken,
    REG_PENDING_COOKIE,
    REG_VERIFIED_COOKIE,
    REG_PENDING_DURATION_SECONDS,
    REG_VERIFIED_DURATION_SECONDS,
    RESET_PENDING_COOKIE,
    RESET_VERIFIED_COOKIE,
    RESET_PENDING_DURATION_SECONDS,
    RESET_VERIFIED_DURATION_SECONDS,
} from '@/lib/customer-auth';
import { createTrackedCustomerSession } from '@/lib/login-sessions';
import { requireCustomerSession } from '@/lib/customer-session';
import {
    isValidEmail,
    validateRegistration,
    type FieldErrors,
} from '@/lib/registration-validation';

export interface RegisterFormState {
    /** Form-level problem: expired session, duplicate account, mail failure. */
    error?: string;
    /** Per-field problems, keyed by input name. */
    fieldErrors?: FieldErrors;
    /**
     * What was submitted, echoed back so a rejected form redraws with the
     * values still in it. Passwords are deliberately absent — re-typing one is
     * a small cost next to keeping it in a server response.
     */
    values?: Record<string, string>;
}

const OTP_TTL_MINUTES = 10;
const COOKIE_BASE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}



// Throws only for a caller-facing message; the underlying SMTP/config error is
// logged so it's still visible to whoever operates the deployment. `purpose`
// keeps a registration OTP and a password-reset OTP for the same email from
// ever being interchangeable.
async function issueOtp(email: string, purpose: VerificationPurpose) {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Invalidate any earlier unverified codes for this email + purpose before issuing a new one.
    await prisma.emailVerification.deleteMany({ where: { email, purpose, verifiedAt: null } });
    const verification = await prisma.emailVerification.create({ data: { email, otp, purpose, expiresAt } });

    try {
        await sendVerificationEmail(email, otp);
    } catch (error) {
        // A failed send must not leave an undelivered code active. Limit this
        // cleanup to this attempt so a concurrent successful resend survives.
        await prisma.emailVerification.deleteMany({ where: { id: verification.id, verifiedAt: null } });
        console.error('Failed to send verification email:', error);
        throw new Error('We could not send a verification email right now. Please try again shortly.');
    }
}

// Step 1: collect + verify the email address before anything else. No account
// exists yet at this point — we're only confirming the user controls this inbox.
export async function requestEmailVerificationAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const values = { email };

    if (!email) {
        return { fieldErrors: { email: 'Email address is required.' }, values };
    }
    if (!isValidEmail(email)) {
        return { fieldErrors: { email: 'Enter a valid email address.' }, values };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return {
            fieldErrors: { email: 'An account with this email already exists. Try signing in instead.' },
            values,
        };
    }

    try {
        await issueOtp(email, 'REGISTRATION');
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }

    const pendingToken = await signPendingEmailToken(email);
    const cookieStore = await cookies();
    cookieStore.set(REG_PENDING_COOKIE, pendingToken, { ...COOKIE_BASE, maxAge: REG_PENDING_DURATION_SECONDS });

    redirect('/register');
}

export async function resendVerificationCodeAction(): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(REG_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyRegToken(pendingToken) : null;
    if (!pending) {
        return { error: 'Your verification session expired. Start again.' };
    }

    try {
        await issueOtp(pending.email, 'REGISTRATION');
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }

    const refreshedToken = await signPendingEmailToken(pending.email);
    cookieStore.set(REG_PENDING_COOKIE, refreshedToken, { ...COOKIE_BASE, maxAge: REG_PENDING_DURATION_SECONDS });

    return {};
}

// Step 1b: check the OTP. Once correct, the email is marked verified and we
// hand back a short-lived signed cookie — step 3 trusts that cookie for the
// email address, never a form field, so it can't be spoofed client-side.
export async function verifyEmailOtpAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(REG_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyRegToken(pendingToken) : null;

    if (!pending) {
        return { error: 'Your verification session expired. Start again.' };
    }

    const code = String(formData.get('otp') ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { error: 'Enter the 6-digit code from your email.' };
    }

    const record = await prisma.emailVerification.findFirst({
        where: { email: pending.email, purpose: 'REGISTRATION', verifiedAt: null },
        orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
        return { error: 'That code has expired. Request a new one.' };
    }

    if (record.otp !== code) {
        return { error: 'That code is incorrect.' };
    }

    await prisma.emailVerification.update({ where: { id: record.id }, data: { verifiedAt: new Date() } });

    const verifiedToken = await signVerifiedEmailToken(pending.email);
    cookieStore.set(REG_VERIFIED_COOKIE, verifiedToken, { ...COOKIE_BASE, maxAge: REG_VERIFIED_DURATION_SECONDS });
    cookieStore.delete(REG_PENDING_COOKIE);

    redirect('/register');
}

// Step 3: create the account. Role is always CUSTOMER — this action has no
// "role" field to read in the first place, so there's nothing for a request
// to elevate even if someone tried to smuggle one in.
export async function createCustomerAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(REG_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyRegToken(verifiedToken) : null;

    if (!verified) {
        return { error: 'Your verification session expired. Start again.' };
    }

    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    // Echoed on every rejection so the form redraws filled in. The password is
    // never included.
    const values = { firstName, lastName, phone };

    const fieldErrors = validateRegistration({ firstName, lastName, phone, password });
    if (Object.keys(fieldErrors).length > 0) {
        return { fieldErrors, values };
    }

    const existing = await prisma.user.findUnique({ where: { email: verified.email } });
    if (existing) {
        return {
            error: 'An account with this email already exists. Try signing in instead.',
            values,
        };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email: verified.email,
            passwordHash,
            role: 'CUSTOMER',
            firstName,
            lastName,
            phone,
            name: `${firstName} ${lastName}`,
            emailVerifiedAt: new Date(),
        },
    });

    cookieStore.delete(REG_VERIFIED_COOKIE);
    cookieStore.delete(REG_PENDING_COOKIE);

    const sessionToken = await createTrackedCustomerSession(user);
    cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, { ...COOKIE_BASE, maxAge: CUSTOMER_SESSION_DURATION_SECONDS });

    redirect('/dashboard');
}

export async function restartRegistrationAction() {
    const cookieStore = await cookies();
    cookieStore.delete(REG_PENDING_COOKIE);
    cookieStore.delete(REG_VERIFIED_COOKIE);
    redirect('/register');
}

// Forgot password, step 1: only ever issue a code for an email that already
// has a customer account — unlike registration, there's nothing useful to do
// for an email that doesn't.
export async function requestPasswordResetAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    if (!isValidEmail(email)) {
        return { error: 'Enter a valid email address.' };
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'CUSTOMER') {
        return { error: 'No account found with this email address.' };
    }

    try {
        await issueOtp(email, 'PASSWORD_RESET');
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }

    const pendingToken = await signResetPendingToken(email);
    const cookieStore = await cookies();
    cookieStore.set(RESET_PENDING_COOKIE, pendingToken, { ...COOKIE_BASE, maxAge: RESET_PENDING_DURATION_SECONDS });

    redirect('/customer/forgot-password');
}

export async function resendPasswordResetCodeAction(): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(RESET_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyResetToken(pendingToken) : null;
    if (!pending) {
        return { error: 'Your reset session expired. Start again.' };
    }

    try {
        await issueOtp(pending.email, 'PASSWORD_RESET');
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' };
    }

    const refreshedToken = await signResetPendingToken(pending.email);
    cookieStore.set(RESET_PENDING_COOKIE, refreshedToken, { ...COOKIE_BASE, maxAge: RESET_PENDING_DURATION_SECONDS });

    return {};
}

// Forgot password, step 2: same trust model as registration's OTP check —
// the email only ever comes from the signed cookie, never a form field.
export async function verifyPasswordResetOtpAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(RESET_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyResetToken(pendingToken) : null;

    if (!pending) {
        return { error: 'Your reset session expired. Start again.' };
    }

    const code = String(formData.get('otp') ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { error: 'Enter the 6-digit code from your email.' };
    }

    const record = await prisma.emailVerification.findFirst({
        where: { email: pending.email, purpose: 'PASSWORD_RESET', verifiedAt: null },
        orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
        return { error: 'That code has expired. Request a new one.' };
    }

    if (record.otp !== code) {
        return { error: 'That code is incorrect.' };
    }

    await prisma.emailVerification.update({ where: { id: record.id }, data: { verifiedAt: new Date() } });

    const verifiedToken = await signResetVerifiedToken(pending.email);
    cookieStore.set(RESET_VERIFIED_COOKIE, verifiedToken, { ...COOKIE_BASE, maxAge: RESET_VERIFIED_DURATION_SECONDS });
    cookieStore.delete(RESET_PENDING_COOKIE);

    redirect('/customer/forgot-password');
}

// Forgot password, step 3: set the new password. Requires the verified-reset
// cookie from step 2 — there's no path here that doesn't go through the OTP.
export async function resetPasswordAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(RESET_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyResetToken(verifiedToken) : null;

    if (!verified) {
        return { error: 'Your reset session expired. Start again.' };
    }

    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
    }
    if (password !== confirmPassword) {
        return { error: 'Passwords do not match.' };
    }

    const user = await prisma.user.findUnique({ where: { email: verified.email } });
    if (!user || user.role !== 'CUSTOMER') {
        return { error: 'No account found with this email address.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    cookieStore.delete(RESET_VERIFIED_COOKIE);
    cookieStore.delete(RESET_PENDING_COOKIE);

    await prisma.loginSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });

    redirect('/login?reset=success');
}

export async function restartPasswordResetAction() {
    const cookieStore = await cookies();
    cookieStore.delete(RESET_PENDING_COOKIE);
    cookieStore.delete(RESET_VERIFIED_COOKIE);
    redirect('/customer/forgot-password');
}

// Signing in lives in app/login/actions.ts now — one action for both roles,
// so this customer-only version would have been a second, diverging copy.
export async function customerLogoutAction() {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
    const session = token ? await verifyCustomerSessionToken(token) : null;
    if (session?.sessionId) {
        await prisma.loginSession.updateMany({ where: { id: session.sessionId, userId: session.userId }, data: { revokedAt: new Date() } });
    }
    cookieStore.delete(CUSTOMER_SESSION_COOKIE);
    redirect('/login');
}

const SUBSCRIPTION_INCLUDE = { plan: true, addOns: { include: { addOn: true } } } as const;

// A customer can hold at most one subscription per product (one AlgoSuite
// plan + one Unity Commerce plan at the same time) — enforced by the
// [userId, product] unique index on Subscription, not just app logic.
export async function getSubscriptions(userId: string) {
    const session = await requireCustomerSession();
    if (session.userId !== userId) throw new Error('You cannot access another customer account.');
    return prisma.subscription.findMany({
        where: { userId },
        include: SUBSCRIPTION_INCLUDE,
        orderBy: { productId: 'asc' },
    });
}

export async function getSubscriptionForProduct(userId: string, product: string) {
    const session = await requireCustomerSession();
    if (session.userId !== userId) throw new Error('You cannot access another customer account.');
    return prisma.subscription.findUnique({
        where: { userId_productId: { userId, productId: product } },
        include: SUBSCRIPTION_INCLUDE,
    });
}

// Purchase (or switch) a plan. Custom-quote plans (no price) aren't
// self-serve — the pricing page routes those to "Contact sales" instead of
// this action, and this is checked again here so a crafted request can't
// bypass that. Only the subscription for the SAME product is touched — a
// customer purchasing a Unity Commerce plan keeps their AlgoSuite
// subscription (and its add-ons) untouched, and vice versa.
/**
 * Starts a Paddle checkout for a plan. It does NOT grant anything.
 *
 * This used to write an ACTIVE subscription straight from the form post, which
 * meant a paid plan cost nothing to acquire — any session could post a planId
 * and be subscribed. The grant now happens only in the Paddle webhook, against
 * a payload Paddle signed (app/api/paddle/webhook/route.ts).
 *
 * What comes back is just what the browser needs to open Paddle's overlay. The
 * price id is read from the plan rather than taken from the client, so the
 * customer cannot substitute a cheaper one; `customData` carries the ids the
 * webhook uses to work out who bought what, and the webhook re-checks them
 * against our own tables because they travel through the browser.
 */
export interface CheckoutIntent {
    ok: boolean;
    error?: string;
    priceId?: string;
    email?: string;
    customData?: { userId: string; planId: string };
}

export async function startPlanCheckoutAction(planId: string): Promise<CheckoutIntent> {
    const session = await requireCustomerSession();
    if (!planId) return { ok: false, error: 'No plan selected.' };

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) return { ok: false, error: 'That plan is not available.' };
    if (plan.priceAmount == null) {
        return { ok: false, error: 'This plan is quoted individually — please contact sales.' };
    }
    if (!plan.paddlePriceId) {
        return {
            ok: false,
            error: 'This plan has no Paddle price configured yet. An administrator can add one in the admin plan settings.',
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true },
    });

    return {
        ok: true,
        priceId: plan.paddlePriceId,
        email: user?.email,
        customData: { userId: session.userId, planId: plan.id },
    };
}

/**
 * Whether the webhook has landed for a plan the customer just paid for.
 *
 * The checkout overlay reports `checkout.completed` the moment Paddle accepts
 * the customer's details, which is before settlement and before our webhook
 * has written anything. The button polls this instead of refreshing once and
 * hoping: a single refresh usually lands *before* the webhook and leaves the
 * page looking as though the payment did nothing.
 *
 * Reads only the caller's own subscription, so it grants nothing and cannot be
 * used to probe anyone else's billing.
 */
export async function checkoutSettlementAction(planId: string): Promise<{
    settled: boolean;
    status?: string;
}> {
    const session = await requireCustomerSession();
    if (!planId) return { settled: false };

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { productId: true },
    });
    if (!plan) return { settled: false };

    const subscription = await prisma.subscription.findUnique({
        where: { userId_productId: { userId: session.userId, productId: plan.productId } },
        select: { status: true, planId: true },
    });
    if (!subscription) return { settled: false };

    // Settled means "this plan, and paying" — an older subscription to the
    // same product sitting there ACTIVE is not evidence this purchase landed.
    const settled = subscription.planId === planId
        && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');

    return { settled, status: subscription.status };
}

/**
 * Same as `startPlanCheckoutAction`, for the onboarding flow.
 *
 * Onboarding arrives with `?plan=Growth` — a display name, not an id — so the
 * plan is looked up by name or slug and then handed to the same checks. It
 * resolves against active plans only, so a stale link cannot open checkout on
 * a retired plan.
 */
export async function startPlanCheckoutBySlugAction(nameOrSlug: string): Promise<CheckoutIntent> {
    await requireCustomerSession();
    const needle = nameOrSlug.trim();
    if (!needle) return { ok: false, error: 'No plan selected.' };

    const plan = await prisma.plan.findFirst({
        where: {
            isActive: true,
            OR: [
                { slug: { equals: needle, mode: 'insensitive' } },
                { name: { equals: needle, mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    });
    if (!plan) return { ok: false, error: `We could not find a plan called "${needle}".` };

    return startPlanCheckoutAction(plan.id);
}

// Add an add-on to the caller's subscription for that add-on's product —
// each product has its own subscription, so the add-on's own product tells
// us which one to attach it to. Both the add-on and the matching
// subscription must actually exist and be active, checked server-side.
export async function addSubscriptionAddOnAction(formData: FormData) {
    const session = await requireCustomerSession();
    const addOnId = String(formData.get('addOnId') ?? '');
    if (!addOnId) return;

    const addOn = await prisma.addOn.findUnique({ where: { id: addOnId } });
    if (!addOn || !addOn.isActive) return;

    const subscription = await getSubscriptionForProduct(session.userId, addOn.productId);
    if (!subscription) return;

    await prisma.subscriptionAddOn.upsert({
        where: { subscriptionId_addOnId: { subscriptionId: subscription.id, addOnId } },
        update: {},
        create: { subscriptionId: subscription.id, addOnId },
    });

    revalidatePath('/dashboard/subscription');
    revalidatePath('/dashboard');
}

export async function removeSubscriptionAddOnAction(formData: FormData) {
    const session = await requireCustomerSession();
    const addOnId = String(formData.get('addOnId') ?? '');
    if (!addOnId) return;

    const addOn = await prisma.addOn.findUnique({ where: { id: addOnId } });
    if (!addOn) return;

    const subscription = await getSubscriptionForProduct(session.userId, addOn.productId);
    if (!subscription) return;

    await prisma.subscriptionAddOn.deleteMany({ where: { subscriptionId: subscription.id, addOnId } });

    revalidatePath('/dashboard/subscription');
    revalidatePath('/dashboard');
}

export interface AccountFormState {
    error?: string;
    success?: string;
}

function isValidPhone(phone: string) {
    return /^[+\d][\d\s()-]{6,19}$/.test(phone);
}

function isValidUsername(username: string) {
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
}

export async function updateProfileAction(_prevState: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const username = String(formData.get('username') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const company = String(formData.get('company') ?? '').trim();
    const companyEmail = String(formData.get('companyEmail') ?? '').trim();

    if (!firstName || !lastName) {
        return { error: 'First name and last name are required.' };
    }
    if (username && !isValidUsername(username)) {
        return { error: 'Username must be 3-30 characters and use only letters, numbers, underscores, or hyphens.' };
    }
    if (phone && !isValidPhone(phone)) {
        return { error: 'Enter a valid mobile number.' };
    }
    if (companyEmail && !isValidEmail(companyEmail)) {
        return { error: 'Enter a valid company email address.' };
    }

    if (username) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing && existing.id !== session.userId) {
            return { error: 'That username is already taken.' };
        }
    }

    await prisma.user.update({
        where: { id: session.userId },
        data: {
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim(),
            username: username || null,
            phone: phone || null,
            company: company || null,
            companyEmail: companyEmail || null,
        },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/profile');
    revalidatePath('/dashboard');
    redirect('/dashboard/settings?profileUpdated=1');
}

export async function updateCustomerPasswordAction(
    _prevState: AccountFormState | undefined,
    formData: FormData
): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmNewPassword = String(formData.get('confirmNewPassword') ?? '');

    if (newPassword.length < 8) {
        return { error: 'New password must be at least 8 characters.' };
    }
    if (newPassword !== confirmNewPassword) {
        return { error: 'New passwords do not match.' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) redirect('/login');

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
        return { error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
        return { error: 'Choose a password different from your current password.' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
        prisma.loginSession.updateMany({ where: { userId: user.id, id: { not: session.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    return { success: 'Password updated. Other login sessions have been signed out.' };
}

function readAddressFields(formData: FormData) {
    return {
        addressLine1: String(formData.get('addressLine1') ?? '').trim(),
        addressLine2: String(formData.get('addressLine2') ?? '').trim() || null,
        city: String(formData.get('city') ?? '').trim(),
        state: String(formData.get('state') ?? '').trim(),
        country: String(formData.get('country') ?? '').trim(),
        postcode: String(formData.get('postcode') ?? '').trim(),
        isDefault: formData.get('isDefault') === 'on',
    };
}

function validateAddressFields(fields: ReturnType<typeof readAddressFields>) {
    if (!fields.addressLine1 || !fields.city || !fields.state || !fields.country || !fields.postcode) {
        return 'Address line 1, city, state, country, and postcode are required.';
    }
    return null;
}

export async function createAddressAction(_prevState: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const fields = readAddressFields(formData);

    const error = validateAddressFields(fields);
    if (error) return { error };

    const existingCount = await prisma.address.count({ where: { userId: session.userId } });
    const makeDefault = fields.isDefault || existingCount === 0;

    if (makeDefault) {
        await prisma.$transaction([
            prisma.address.updateMany({ where: { userId: session.userId }, data: { isDefault: false } }),
            prisma.address.create({ data: { ...fields, isDefault: true, userId: session.userId } }),
        ]);
    } else {
        await prisma.address.create({ data: { ...fields, userId: session.userId } });
    }

    revalidatePath('/dashboard/settings/addresses');
    redirect('/dashboard/settings/addresses');
}

export async function updateAddressAction(
    id: string,
    _prevState: AccountFormState | undefined,
    formData: FormData
): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
        return { error: 'Address not found.' };
    }

    const fields = readAddressFields(formData);
    const error = validateAddressFields(fields);
    if (error) return { error };

    if (fields.isDefault) {
        await prisma.$transaction([
            prisma.address.updateMany({ where: { userId: session.userId }, data: { isDefault: false } }),
            prisma.address.update({ where: { id }, data: { ...fields, isDefault: true } }),
        ]);
    } else {
        await prisma.address.update({ where: { id }, data: fields });
    }

    revalidatePath('/dashboard/settings/addresses');
    redirect('/dashboard/settings/addresses');
}

export async function deleteAddressAction(formData: FormData) {
    const session = await requireCustomerSession();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) return;

    await prisma.address.delete({ where: { id } });

    // If the deleted address was the default and other addresses remain,
    // promote the most recently added one so there's always a default
    // whenever at least one address exists.
    if (existing.isDefault) {
        const fallback = await prisma.address.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' } });
        if (fallback) {
            await prisma.address.update({ where: { id: fallback.id }, data: { isDefault: true } });
        }
    }

    revalidatePath('/dashboard/settings/addresses');
}

export async function setDefaultAddressAction(formData: FormData) {
    const session = await requireCustomerSession();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) return;

    await prisma.$transaction([
        prisma.address.updateMany({ where: { userId: session.userId }, data: { isDefault: false } }),
        prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);

    revalidatePath('/dashboard/settings/addresses');
}

export async function createSupportTicketAction(_prevState: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const subject = String(formData.get('subject') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();

    if (!subject || !description) {
        return { error: 'Subject and description are required.' };
    }

    const ticket = await prisma.supportTicket.create({
        data: { userId: session.userId, subject, description, status: 'OPEN' },
    });

    revalidatePath('/dashboard/support');
    redirect(`/dashboard/support/${ticket.id}`);
}

export async function addTicketCommentAction(formData: FormData) {
    const session = await requireCustomerSession();
    const ticketId = String(formData.get('ticketId') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    if (!ticketId || !body) return;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.userId !== session.userId) return;

    await createComment(CommentEntityType.SUPPORT_TICKET, ticketId, session.userId, body);

    revalidatePath(`/dashboard/support/${ticketId}`);
}
