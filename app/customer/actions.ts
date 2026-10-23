'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { VerificationPurpose } from '@/db/types';
import { db, schema } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { sendEventEmail } from '@/lib/email-templates';
import { allowCodeRequest, checkOtp, generateOtp } from '@/lib/otp';
import { CommentEntityType, createComment } from '@/lib/comments';
import {
    verifyCustomerSessionToken,
    CUSTOMER_SESSION_COOKIE,
    CUSTOMER_SESSION_DURATION_SECONDS,
    signPendingEmailToken,
    signVerifiedEmailToken,
    signResetPendingToken,
    signResetVerifiedToken,
    verifyRegPendingToken,
    verifyRegVerifiedToken,
    verifyResetPendingToken,
    verifyResetVerifiedToken,
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
import { createPlanCheckout, cancelPendingCheckout } from '@/lib/checkout-billing';
import { CREDITS_ENABLED, wantsCredits } from '@/lib/billing-features';
import { assertSiteAppsFitPlan, PlanAccessError } from '@/lib/app-plan-access';
import { takePlanIntent } from '@/lib/plan-intent';
import { cancelAtPeriodEnd, resumeScheduledCancellation, SubscriptionActionError } from '@/lib/subscription-lifecycle';
import { asRecord, asString } from '@/lib/paddle-data';
import { prepareRenewalCredits, cancelRenewalCredits, releaseCreditOperation } from '@/lib/credit-billing';
import { reconcilePaddleSubscription } from '@/lib/paddle-sync';
import { syncSiteBilling } from '@/lib/site-billing-lifecycle';
import { controller } from '@/lib/controller-client';
import { previewPlanChange, commitPlanChange, customerPortal } from '@/lib/subscription-billing';
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
    values?: Record<string, string>;
}

const OTP_TTL_MINUTES = 10;
const COOKIE_BASE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

async function issueOtp(email: string, purpose: VerificationPurpose) {
    const allowed = await allowCodeRequest(email, purpose);
    if (!allowed.allowed) throw new Error(allowed.message);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await db.delete(schema.emailVerification).where(and(
        eq(schema.emailVerification.email, email),
        eq(schema.emailVerification.purpose, purpose),
        isNull(schema.emailVerification.verifiedAt),
    ));
    const [verification] = await db.insert(schema.emailVerification).values({ email, otp, purpose, expiresAt }).returning();

    try {
        await sendVerificationEmail(email, otp);
    } catch (error) {
        await db.delete(schema.emailVerification).where(and(
            eq(schema.emailVerification.id, verification.id),
            isNull(schema.emailVerification.verifiedAt),
        ));
        console.error('Failed to send verification email:', error);
        throw new Error('We could not send a verification email right now. Please try again shortly.');
    }
}

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

    const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });

    try {
        if (existing) {
            const allowed = await allowCodeRequest(email, 'REGISTRATION');
            if (!allowed.allowed) throw new Error(allowed.message);
            await sendEventEmail('registration_existing_account', email, { 'user.email': email, 'user.name': existing.name ?? email, login_url: `${process.env.PLATFORM_PUBLIC_URL || 'https://www.unityalgo.com'}/login` });
        } else {
            await issueOtp(email, 'REGISTRATION');
        }
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
    const pending = pendingToken ? await verifyRegPendingToken(pendingToken) : null;
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

export async function verifyEmailOtpAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(REG_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyRegPendingToken(pendingToken) : null;

    if (!pending) {
        return { error: 'Your verification session expired. Start again.' };
    }

    const code = String(formData.get('otp') ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { error: 'Enter the 6-digit code from your email.' };
    }

    const checked = await checkOtp(pending.email, 'REGISTRATION', code);
    if (!checked.ok) return { error: checked.error };

    const verifiedToken = await signVerifiedEmailToken(pending.email);
    cookieStore.set(REG_VERIFIED_COOKIE, verifiedToken, { ...COOKIE_BASE, maxAge: REG_VERIFIED_DURATION_SECONDS });
    cookieStore.delete(REG_PENDING_COOKIE);

    redirect('/register');
}

export async function createCustomerAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(REG_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyRegVerifiedToken(verifiedToken) : null;

    if (!verified) {
        return { error: 'Your verification session expired. Start again.' };
    }

    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    const values = { firstName, lastName, phone };

    const fieldErrors = validateRegistration({ firstName, lastName, phone, password });
    if (Object.keys(fieldErrors).length > 0) {
        return { fieldErrors, values };
    }

    const existing = await db.query.user.findFirst({ where: eq(schema.user.email, verified.email) });
    if (existing) {
        return {
            error: 'An account with this email already exists. Try signing in instead.',
            values,
        };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db.insert(schema.user).values({
            email: verified.email,
            passwordHash,
            role: 'CUSTOMER',
            firstName,
            lastName,
            phone,
            name: `${firstName} ${lastName}`,
            emailVerifiedAt: new Date(),
        }).returning();

    cookieStore.delete(REG_VERIFIED_COOKIE);
    cookieStore.delete(REG_PENDING_COOKIE);

    const sessionToken = await createTrackedCustomerSession(user);
    cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, { ...COOKIE_BASE, maxAge: CUSTOMER_SESSION_DURATION_SECONDS });

    redirect((await takePlanIntent()) ?? '/dashboard');
}

export async function restartRegistrationAction() {
    const cookieStore = await cookies();
    cookieStore.delete(REG_PENDING_COOKIE);
    cookieStore.delete(REG_VERIFIED_COOKIE);
    redirect('/register');
}

export async function requestPasswordResetAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    if (!isValidEmail(email)) {
        return { error: 'Enter a valid email address.' };
    }

    const user = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
    try {
        if (user && user.role === 'CUSTOMER') {
            await issueOtp(email, 'PASSWORD_RESET');
        } else {
            const allowed = await allowCodeRequest(email, 'PASSWORD_RESET');
            if (!allowed.allowed) throw new Error(allowed.message);
            await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));
        }
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
    const pending = pendingToken ? await verifyResetPendingToken(pendingToken) : null;
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

export async function verifyPasswordResetOtpAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(RESET_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyResetPendingToken(pendingToken) : null;

    if (!pending) {
        return { error: 'Your reset session expired. Start again.' };
    }

    const code = String(formData.get('otp') ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { error: 'Enter the 6-digit code from your email.' };
    }

    const checked = await checkOtp(pending.email, 'PASSWORD_RESET', code);
    if (!checked.ok) return { error: checked.error };

    const verifiedToken = await signResetVerifiedToken(pending.email);
    cookieStore.set(RESET_VERIFIED_COOKIE, verifiedToken, { ...COOKIE_BASE, maxAge: RESET_VERIFIED_DURATION_SECONDS });
    cookieStore.delete(RESET_PENDING_COOKIE);

    redirect('/customer/forgot-password');
}

export async function resetPasswordAction(
    _prevState: RegisterFormState | undefined,
    formData: FormData
): Promise<RegisterFormState> {
    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(RESET_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyResetVerifiedToken(verifiedToken) : null;

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

    const user = await db.query.user.findFirst({ where: eq(schema.user.email, verified.email) });
    if (!user || user.role !== 'CUSTOMER') {
        return { error: 'No account found with this email address.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(schema.user).set({ passwordHash }).where(eq(schema.user.id, user.id));

    cookieStore.delete(RESET_VERIFIED_COOKIE);
    cookieStore.delete(RESET_PENDING_COOKIE);

    await db.update(schema.loginSession).set({ revokedAt: new Date() })
        .where(and(eq(schema.loginSession.userId, user.id), isNull(schema.loginSession.revokedAt)));

    redirect('/login?reset=success');
}

export async function restartPasswordResetAction() {
    const cookieStore = await cookies();
    cookieStore.delete(RESET_PENDING_COOKIE);
    cookieStore.delete(RESET_VERIFIED_COOKIE);
    redirect('/customer/forgot-password');
}

export async function customerLogoutAction() {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
    const session = token ? await verifyCustomerSessionToken(token) : null;
    if (session?.sessionId) {
        await db.update(schema.loginSession).set({ revokedAt: new Date() })
            .where(and(eq(schema.loginSession.id, session.sessionId), eq(schema.loginSession.userId, session.userId)));
    }
    cookieStore.delete(CUSTOMER_SESSION_COOKIE);
    redirect('/login');
}

const SUBSCRIPTION_WITH = { plan: { with: { currency: true } }, addOns: { with: { addOn: true } } } as const;

export async function getSubscriptions(userId: string) {
    const session = await requireCustomerSession();
    if (session.userId !== userId) throw new Error('You cannot access another customer account.');
    return db.query.subscription.findMany({
        where: eq(schema.subscription.userId, userId),
        with: SUBSCRIPTION_WITH,
        orderBy: asc(schema.subscription.productId),
    });
}

async function getSubscriptionForProduct(userId: string, product: string) {
    const session = await requireCustomerSession();
    if (session.userId !== userId) throw new Error('You cannot access another customer account.');
    return (await db.query.subscription.findFirst({
        where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.productId, product)),
        with: SUBSCRIPTION_WITH,
    })) ?? null;
}

export interface CheckoutIntent {
    ok: boolean;
    error?: string;
    transactionId?: string;
    pendingCheckout?: boolean;
    change?: { operationId: string; amount: string; currency: string; action: string; creditsApplied: number };
}

export async function startPlanCheckoutAction(planId: string, useCredits = true, siteId?: string, subscriptionId?: string): Promise<CheckoutIntent> {
    const session = await requireCustomerSession();
    const plan = await db.query.plan.findFirst({ where: and(eq(schema.plan.id, planId), eq(schema.plan.isActive, true)) });
    if (!plan?.paddlePriceId || plan.priceAmount == null) return { ok: false, error: 'That plan is not available for online payment.' };
    try {
        const matches = await db.query.subscription.findMany({ where: and(eq(schema.subscription.userId, session.userId), eq(schema.subscription.productId, plan.productId), siteId ? eq(schema.subscription.siteId, siteId) : undefined, subscriptionId ? eq(schema.subscription.id, subscriptionId) : undefined) });
        if (matches.length > 1) throw new Error('Open the site to change its plan.');
        let existing = matches[0];
        if (siteId && !existing) {
            const site = await controller.sites.get(siteId, session.userId);
            const candidates = await db.query.subscription.findMany({ where: and(eq(schema.subscription.userId, session.userId), eq(schema.subscription.productId, plan.productId), isNull(schema.subscription.siteId), isNull(schema.subscription.siteOrderId), eq(schema.subscription.planId, site.plan_id ?? ''), eq(schema.subscription.status, 'ACTIVE')) });
            if (candidates.length !== 1) throw new Error('This site needs its billing subscription linked by support.');
            const [bound] = await db.update(schema.subscription).set({ siteId, appliedPlanId: site.plan_id, appliedAt: new Date() }).where(and(eq(schema.subscription.id, candidates[0].id), isNull(schema.subscription.siteId))).returning();
            existing = bound;
        }
        if (siteId && !existing?.paddleSubscriptionId) throw new Error('This site has no linked paid subscription. Contact support to link its billing.');
        if (existing?.paddleSubscriptionId && existing.status !== 'CANCELED') {
            // A lower plan must still be able to run every app already on the site.
            if (existing.siteId) {
                const site = await controller.sites.get(existing.siteId, session.userId).catch(() => null);
                try { await assertSiteAppsFitPlan(site?.apps ?? [], planId); }
                catch (error) { if (error instanceof PlanAccessError) throw new Error(error.message); throw error; }
            }
            const quote = await previewPlanChange(session.userId, planId, wantsCredits(useCredits), existing.paddleSubscriptionId);
            const preview = asRecord(quote.preview);
            const immediate = asRecord(preview.immediate_transaction);
            const totals = asRecord(asRecord(immediate.details).totals);
            const result = asRecord(asRecord(preview.update_summary).result);
            const amount = result.action === 'credit' ? asString(result.amount) : asString(totals.balance) ?? asString(totals.grand_total) ?? asString(result.amount);
            const currency = asString(immediate.currency_code) ?? asString(result.currency_code);
            if (!amount || !currency) throw new Error('Paddle did not return a complete billing preview.');
            return { ok: true, change: { operationId: quote.operationId, amount, currency, action: asString(result.action) ?? 'charge', creditsApplied: quote.creditsApplied } };
        }
        const transactionId = await createPlanCheckout(session.userId, planId, wantsCredits(useCredits));
        return { ok: true, transactionId };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not start billing.';
        return { ok: false, error: message, pendingCheckout: message.startsWith('Finish or cancel') };
    }
}

export async function cancelPlanChangeQuoteAction(operationId: string) {
    const session = await requireCustomerSession();
    try {
        const [operation] = await db.update(schema.billingOperation).set({ status: 'FAILED', error: 'Customer canceled the preview.', updatedAt: new Date() })
            .where(and(eq(schema.billingOperation.id, operationId), eq(schema.billingOperation.userId, session.userId), eq(schema.billingOperation.status, 'QUOTED'))).returning();
        if (!operation) throw new Error('This billing change has already progressed. Refresh to check its status.');
        await releaseCreditOperation(operation.id);
        return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Credits are being returned. Please refresh shortly.' }; }
}

export async function cancelPendingCheckoutAction(planId: string) {
    const session = await requireCustomerSession();
    try { await cancelPendingCheckout(session.userId, planId); return { ok: true }; }
    catch { return { ok: false, error: 'Checkout could not be canceled. Check your billing history before retrying.' }; }
}

export async function confirmPlanChangeAction(operationId: string) {
    const session = await requireCustomerSession();
    try { await commitPlanChange(session.userId, operationId); return { ok: true }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not change plan.' }; }
}

export async function scheduleRenewalCreditsAction(subscriptionId: string) {
    const session = await requireCustomerSession();
    if (!CREDITS_ENABLED) return { ok: false, error: 'Account credits are not available yet.' };
    try {
        const result = await prepareRenewalCredits(session.userId, subscriptionId);
        revalidatePath('/dashboard/subscription');
        return { ok: true, ...result };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not schedule credits.' }; }
}

export async function releaseRenewalCreditsAction(redemptionId: string) {
    const session = await requireCustomerSession();
    try {
        await cancelRenewalCredits(session.userId, redemptionId);
        revalidatePath('/dashboard/subscription');
        return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not release credits.' }; }
}

export async function openBillingPortalAction(subscriptionId: string) {
    const session = await requireCustomerSession();
    return customerPortal(session.userId, subscriptionId);
}

export async function checkoutSettlementAction(planId: string, siteId?: string, subscriptionId?: string): Promise<{
    settled: boolean;
    status?: string;
}> {
    const session = await requireCustomerSession();
    if (!planId) return { settled: false };

    const plan = await db.query.plan.findFirst({
        where: eq(schema.plan.id, planId),
        columns: { productId: true },
    });
    if (!plan) return { settled: false };

    let subscription = await db.query.subscription.findFirst({
        where: and(eq(schema.subscription.userId, session.userId), eq(schema.subscription.productId, plan.productId), siteId ? eq(schema.subscription.siteId, siteId) : undefined, subscriptionId ? eq(schema.subscription.id, subscriptionId) : undefined),
    });
    if (!subscription) return { settled: false };
    if (siteId && subscription.paddleSubscriptionId && (subscription.planId !== planId || subscription.appliedPlanId !== planId)) {
        await reconcilePaddleSubscription(subscription.paddleSubscriptionId);
        await syncSiteBilling(1, subscription.id);
        subscription = (await db.query.subscription.findFirst({ where: eq(schema.subscription.id, subscription.id) }))!;
    }
    const settled = subscription.planId === planId
        && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL')
        && (!siteId || subscription.appliedPlanId === planId);

    return { settled, status: subscription.status };
}

export async function startPlanCheckoutBySlugAction(nameOrSlug: string): Promise<CheckoutIntent> {
    await requireCustomerSession();
    const needle = nameOrSlug.trim();
    if (!needle) return { ok: false, error: 'No plan selected.' };

    const plan = await db.query.plan.findFirst({
        where: and(
            eq(schema.plan.isActive, true),
            or(
                sql`lower(${schema.plan.slug}) = ${needle.toLowerCase()}`,
                sql`lower(${schema.plan.name}) = ${needle.toLowerCase()}`,
            ),
        ),
        columns: { id: true },
    });
    if (!plan) return { ok: false, error: `We could not find a plan called "${needle}".` };

    return startPlanCheckoutAction(plan.id);
}

export async function addSubscriptionAddOnAction(formData: FormData) {
    const session = await requireCustomerSession();
    const addOnId = String(formData.get('addOnId') ?? '');
    if (!addOnId) return;

    const addOn = await db.query.addOn.findFirst({ where: eq(schema.addOn.id, addOnId) });
    if (!addOn || !addOn.isActive) return;

    const subscription = await getSubscriptionForProduct(session.userId, addOn.productId);
    if (!subscription) return;

    await db
        .insert(schema.subscriptionAddOn)
        .values({ subscriptionId: subscription.id, addOnId })
        .onConflictDoNothing({ target: [schema.subscriptionAddOn.subscriptionId, schema.subscriptionAddOn.addOnId] });

    revalidatePath('/dashboard/subscription');
    revalidatePath('/dashboard');
}

export async function removeSubscriptionAddOnAction(formData: FormData) {
    const session = await requireCustomerSession();
    const addOnId = String(formData.get('addOnId') ?? '');
    if (!addOnId) return;

    const addOn = await db.query.addOn.findFirst({ where: eq(schema.addOn.id, addOnId) });
    if (!addOn) return;

    const subscription = await getSubscriptionForProduct(session.userId, addOn.productId);
    if (!subscription) return;

    await db.delete(schema.subscriptionAddOn).where(and(
        eq(schema.subscriptionAddOn.subscriptionId, subscription.id),
        eq(schema.subscriptionAddOn.addOnId, addOnId),
    ));

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
        const existing = await db.query.user.findFirst({ where: eq(schema.user.username, username) });
        if (existing && existing.id !== session.userId) {
            return { error: 'That username is already taken.' };
        }
    }

    await db.update(schema.user).set({
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim(),
            username: username || null,
            phone: phone || null,
            company: company || null,
            companyEmail: companyEmail || null,
        }).where(eq(schema.user.id, session.userId));

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

    const user = await db.query.user.findFirst({ where: eq(schema.user.id, session.userId) });
    if (!user) redirect('/login');

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
        return { error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
        return { error: 'Choose a password different from your current password.' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.transaction(async (tx) => {
        await tx.update(schema.user).set({ passwordHash }).where(eq(schema.user.id, user.id));
        // Every other signed-in device must log in again with the new password.
        await tx.update(schema.loginSession).set({ revokedAt: new Date() }).where(and(
            eq(schema.loginSession.userId, user.id),
            ne(schema.loginSession.id, session.sessionId),
            isNull(schema.loginSession.revokedAt),
        ));
    });

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

    const existingCount = await db.$count(schema.address, eq(schema.address.userId, session.userId));
    const makeDefault = fields.isDefault || existingCount === 0;

    if (makeDefault) {
        await db.transaction(async (tx) => {
            await tx.update(schema.address).set({ isDefault: false }).where(eq(schema.address.userId, session.userId));
            await tx.insert(schema.address).values({ ...fields, isDefault: true, userId: session.userId });
        });
    } else {
        await db.insert(schema.address).values({ ...fields, userId: session.userId });
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
    const existing = await db.query.address.findFirst({ where: eq(schema.address.id, id) });
    if (!existing || existing.userId !== session.userId) {
        return { error: 'Address not found.' };
    }

    const fields = readAddressFields(formData);
    const error = validateAddressFields(fields);
    if (error) return { error };

    if (fields.isDefault) {
        await db.transaction(async (tx) => {
            await tx.update(schema.address).set({ isDefault: false }).where(eq(schema.address.userId, session.userId));
            await tx.update(schema.address).set({ ...fields, isDefault: true }).where(eq(schema.address.id, id));
        });
    } else {
        await db.update(schema.address).set(fields).where(eq(schema.address.id, id));
    }

    revalidatePath('/dashboard/settings/addresses');
    redirect('/dashboard/settings/addresses');
}

export async function deleteAddressAction(formData: FormData) {
    const session = await requireCustomerSession();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const existing = await db.query.address.findFirst({ where: eq(schema.address.id, id) });
    if (!existing || existing.userId !== session.userId) return;

    await db.delete(schema.address).where(eq(schema.address.id, id));

    if (existing.isDefault) {
        const fallback = await db.query.address.findFirst({ where: eq(schema.address.userId, session.userId), orderBy: desc(schema.address.createdAt) });
        if (fallback) {
            await db.update(schema.address).set({ isDefault: true }).where(eq(schema.address.id, fallback.id));
        }
    }

    revalidatePath('/dashboard/settings/addresses');
}

export async function setDefaultAddressAction(formData: FormData) {
    const session = await requireCustomerSession();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const existing = await db.query.address.findFirst({ where: eq(schema.address.id, id) });
    if (!existing || existing.userId !== session.userId) return;

    await db.transaction(async (tx) => {
        await tx.update(schema.address).set({ isDefault: false }).where(eq(schema.address.userId, session.userId));
        await tx.update(schema.address).set({ isDefault: true }).where(eq(schema.address.id, id));
    });

    revalidatePath('/dashboard/settings/addresses');
}

export async function createSupportTicketAction(_prevState: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
    const session = await requireCustomerSession();
    const subject = String(formData.get('subject') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();

    if (!subject || !description) {
        return { error: 'Subject and description are required.' };
    }

    const [ticket] = await db.insert(schema.supportTicket).values({ userId: session.userId, subject, description, status: 'OPEN' }).returning();

    revalidatePath('/dashboard/support');
    redirect(`/dashboard/support/${ticket.id}`);
}

export async function addTicketCommentAction(formData: FormData) {
    const session = await requireCustomerSession();
    const ticketId = String(formData.get('ticketId') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    if (!ticketId || !body) return;

    const ticket = await db.query.supportTicket.findFirst({ where: eq(schema.supportTicket.id, ticketId) });
    if (!ticket || ticket.userId !== session.userId) return;

    await createComment(CommentEntityType.SUPPORT_TICKET, ticketId, session.userId, body);

    revalidatePath(`/dashboard/support/${ticketId}`);
}

export async function cancelSubscriptionAction(subscriptionId: string): Promise<{ ok: boolean; error?: string; immediate?: boolean }> {
    const session = await requireCustomerSession();
    let immediate = false;
    try { immediate = (await cancelAtPeriodEnd(session.userId, subscriptionId)).immediate; }
    catch (error) { return { ok: false, error: error instanceof SubscriptionActionError ? error.message : 'The subscription could not be canceled. Please try again or contact support.' }; }
    revalidatePath('/dashboard/subscription');
    return { ok: true, immediate };
}

export async function resumeSubscriptionAction(subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
    const session = await requireCustomerSession();
    try { await resumeScheduledCancellation(session.userId, subscriptionId); }
    catch (error) { return { ok: false, error: error instanceof SubscriptionActionError ? error.message : 'The cancellation could not be undone. Please try again or contact support.' }; }
    revalidatePath('/dashboard/subscription');
    return { ok: true };
}
