'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { CommentEntityType, createComment } from '@/lib/comments';
import { getCurrentAdminEmail, requireAdmin } from '@/lib/admin-session';
import { syncPlanToPaddle } from '@/lib/paddle-catalog';

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');

    const adminUser = await prisma.user.findUnique({ where: { email } });
    if (!adminUser || adminUser.role !== 'ADMIN') {
        return { error: 'Invalid email or password.' };
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash);
    if (!passwordMatches) {
        return { error: 'Invalid email or password.' };
    }

    const token = await createSessionToken(adminUser.email);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION_SECONDS,
    });

    redirect('/admin');
}

export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    redirect('/login');
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export interface PostFormState {
    error?: string;
}

export async function createPostAction(_prevState: PostFormState | undefined, formData: FormData): Promise<PostFormState> {
    const title = String(formData.get('title') ?? '').trim();
    const slugInput = String(formData.get('slug') ?? '').trim();
    const excerpt = String(formData.get('excerpt') ?? '').trim();
    const content = String(formData.get('content') ?? '');
    const coverImage = String(formData.get('coverImage') ?? '').trim();
    const published = formData.get('published') === 'on';
    const metaTitle = String(formData.get('metaTitle') ?? '').trim() || null;
    const metaDescription = String(formData.get('metaDescription') ?? '').trim() || null;

    if (!title || !excerpt || !content || !coverImage) {
        return { error: 'Title, excerpt, content, and cover image are required.' };
    }

    const slug = slugInput ? slugify(slugInput) : slugify(title);

    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
        return { error: `Slug "${slug}" is already in use.` };
    }

    await prisma.post.create({
        data: {
            title,
            slug,
            excerpt,
            content,
            coverImage,
            published,
            publishedAt: published ? new Date() : null,
            metaTitle,
            metaDescription,
        },
    });

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    redirect('/admin/blogs');
}

export async function updatePostAction(
    id: string,
    _prevState: PostFormState | undefined,
    formData: FormData
): Promise<PostFormState> {
    const title = String(formData.get('title') ?? '').trim();
    const slugInput = String(formData.get('slug') ?? '').trim();
    const excerpt = String(formData.get('excerpt') ?? '').trim();
    const content = String(formData.get('content') ?? '');
    const coverImage = String(formData.get('coverImage') ?? '').trim();
    const published = formData.get('published') === 'on';
    const metaTitle = String(formData.get('metaTitle') ?? '').trim() || null;
    const metaDescription = String(formData.get('metaDescription') ?? '').trim() || null;

    if (!title || !excerpt || !content || !coverImage) {
        return { error: 'Title, excerpt, content, and cover image are required.' };
    }

    const slug = slugify(slugInput || title);

    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
        return { error: `Slug "${slug}" is already in use.` };
    }

    const current = await prisma.post.findUnique({ where: { id } });

    await prisma.post.update({
        where: { id },
        data: {
            title,
            slug,
            excerpt,
            content,
            coverImage,
            published,
            publishedAt: published ? current?.publishedAt ?? new Date() : null,
            metaTitle,
            metaDescription,
        },
    });

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    revalidatePath(`/blog/${slug}`);
    redirect('/admin/blogs');
}

export async function deletePostAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const post = await prisma.post.delete({ where: { id } });

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
}

export interface ContactFormState {
    error?: string;
}

function readContactFields(formData: FormData) {
    return {
        firstName: String(formData.get('firstName') ?? '').trim(),
        lastName: String(formData.get('lastName') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        message: String(formData.get('message') ?? '').trim(),
    };
}

export async function createContactAction(
    _prevState: ContactFormState | undefined,
    formData: FormData
): Promise<ContactFormState> {
    const fields = readContactFields(formData);

    if (!fields.firstName || !fields.lastName || !fields.email || !fields.phone || !fields.message) {
        return { error: 'All fields are required.' };
    }

    await prisma.contactSubmission.create({ data: fields });

    revalidatePath('/admin/contacts');
    redirect('/admin/contacts');
}

export async function updateContactAction(
    id: string,
    _prevState: ContactFormState | undefined,
    formData: FormData
): Promise<ContactFormState> {
    const fields = readContactFields(formData);

    if (!fields.firstName || !fields.lastName || !fields.email || !fields.phone || !fields.message) {
        return { error: 'All fields are required.' };
    }

    await prisma.contactSubmission.update({ where: { id }, data: fields });

    revalidatePath('/admin/contacts');
    redirect('/admin/contacts');
}

export async function deleteContactSubmissionAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    await prisma.contactSubmission.delete({ where: { id } });

    revalidatePath('/admin/contacts');
}

export async function togglePublishAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return;

    const nextPublished = !post.published;

    await prisma.post.update({
        where: { id },
        data: {
            published: nextPublished,
            publishedAt: nextPublished ? post.publishedAt ?? new Date() : post.publishedAt,
        },
    });

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
}

export interface UserFormState {
    error?: string;
    success?: boolean;
}

export async function createUserAction(
    _prevState: UserFormState | undefined,
    formData: FormData
): Promise<UserFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const name = String(formData.get('name') ?? '').trim() || null;
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
        return { error: 'Email and password are required.' };
    }

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return { error: `A user with email "${email}" already exists.` };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Admin-panel "New User" always creates an ADMIN account — customer accounts
    // can only be created through the public registration flow (app/customer/actions.ts),
    // which hardcodes role: 'CUSTOMER' and never reads a role from the form.
    await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });

    revalidatePath('/admin/users');
    redirect('/admin/users');
}

export async function updateUserAction(
    id: string,
    _prevState: UserFormState | undefined,
    formData: FormData
): Promise<UserFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const name = String(formData.get('name') ?? '').trim() || null;

    if (!email) {
        return { error: 'Email is required.' };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
        return { error: `A user with email "${email}" already exists.` };
    }

    // Role is intentionally never accepted from this form — it's not part of
    // UserFormValues, so there's nothing here for an admin to elevate/change.
    await prisma.user.update({ where: { id }, data: { email, name } });

    revalidatePath('/admin/users');
    redirect('/admin/users');
}

export async function updateUserPasswordAction(
    id: string,
    _prevState: UserFormState | undefined,
    formData: FormData
): Promise<UserFormState> {
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (!password || password.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return { success: true };
}

export async function deleteUserAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const [user, currentEmail] = await Promise.all([
        prisma.user.findUnique({ where: { id } }),
        getCurrentAdminEmail(),
    ]);

    if (!user) return;

    if (user.email === currentEmail) {
        redirect('/admin/users?error=' + encodeURIComponent('You cannot delete your own account.'));
    }

    // Only the "last remaining admin" lockout applies to admins — deleting the
    // last customer is always fine, it just means there are no customers left.
    if (user.role === 'ADMIN') {
        const totalAdmins = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (totalAdmins <= 1) {
            redirect('/admin/users?error=' + encodeURIComponent('Cannot delete the last remaining admin user.'));
        }
    }

    await prisma.user.delete({ where: { id } });

    revalidatePath('/admin/users');
}

function parseOptionalFloat(value: FormDataEntryValue | null) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: FormDataEntryValue | null) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseFeatureLines(value: FormDataEntryValue | null) {
    return String(value ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

export interface PlanFormState {
    error?: string;
}

function readPlanFields(formData: FormData) {
    return {
        product: String(formData.get('product') ?? ''),
        name: String(formData.get('name') ?? '').trim(),
        slugInput: String(formData.get('slug') ?? '').trim(),
        tagline: String(formData.get('tagline') ?? '').trim() || null,
        priceUnit: String(formData.get('priceUnit') ?? 'FLAT_MONTHLY') as 'PER_USER_MONTHLY' | 'FLAT_MONTHLY',
        priceAmount: parseOptionalFloat(formData.get('priceAmount')),
        transactionFeePercent: parseOptionalFloat(formData.get('transactionFeePercent')),
        // Blank means the plan is not sold online — checkout refuses rather
        // than falling back to some other plan's price.
        paddlePriceId: String(formData.get('paddlePriceId') ?? '').trim() || null,
        currencyId: String(formData.get('currencyId') ?? '').trim() || null,
        userLimit: parseOptionalInt(formData.get('userLimit')),
        features: parseFeatureLines(formData.get('features')),
        isActive: formData.get('isActive') === 'on',
        sortOrder: parseOptionalInt(formData.get('sortOrder')) ?? 0,
    };
}

export async function createPlanAction(_prevState: PlanFormState | undefined, formData: FormData): Promise<PlanFormState> {
    const fields = readPlanFields(formData);

    if (!fields.product || !fields.name) {
        return { error: 'Product and name are required.' };
    }

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await prisma.plan.findUnique({ where: { productId_slug: { productId: fields.product, slug } } });
    if (existing) {
        return { error: `A plan with slug "${slug}" already exists for this product.` };
    }

    await prisma.plan.create({
        data: {
            productId: fields.product,
            name: fields.name,
            slug,
            tagline: fields.tagline,
            priceUnit: fields.priceUnit,
            priceAmount: fields.priceAmount,
            paddlePriceId: fields.paddlePriceId,
            currencyId: fields.currencyId,
            transactionFeePercent: fields.transactionFeePercent,
            userLimit: fields.userLimit,
            features: fields.features,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/plans');
}

export async function updatePlanAction(
    id: string,
    _prevState: PlanFormState | undefined,
    formData: FormData
): Promise<PlanFormState> {
    const fields = readPlanFields(formData);

    if (!fields.product || !fields.name) {
        return { error: 'Product and name are required.' };
    }

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await prisma.plan.findUnique({ where: { productId_slug: { productId: fields.product, slug } } });
    if (existing && existing.id !== id) {
        return { error: `A plan with slug "${slug}" already exists for this product.` };
    }

    await prisma.plan.update({
        where: { id },
        data: {
            productId: fields.product,
            name: fields.name,
            slug,
            tagline: fields.tagline,
            priceUnit: fields.priceUnit,
            priceAmount: fields.priceAmount,
            paddlePriceId: fields.paddlePriceId,
            currencyId: fields.currencyId,
            transactionFeePercent: fields.transactionFeePercent,
            userLimit: fields.userLimit,
            features: fields.features,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/plans');
}

export async function deletePlanAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const subscriberCount = await prisma.subscription.count({ where: { planId: id } });
    if (subscriberCount > 0) {
        redirect('/admin/plans?error=' + encodeURIComponent('This plan still has active subscriptions and cannot be deleted. Disable it instead.'));
    }

    await prisma.plan.delete({ where: { id } });

    revalidatePath('/admin/plans');
}

export async function togglePlanActiveAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return;

    await prisma.plan.update({ where: { id }, data: { isActive: !plan.isActive } });

    revalidatePath('/admin/plans');
    revalidatePath('/dashboard/subscription');
}

export interface AddOnFormState {
    error?: string;
}

function readAddOnFields(formData: FormData) {
    return {
        product: String(formData.get('product') ?? ''),
        name: String(formData.get('name') ?? '').trim(),
        slugInput: String(formData.get('slug') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim() || null,
        pricingType: String(formData.get('pricingType') ?? 'FLAT_MONTHLY') as 'FLAT_MONTHLY' | 'ONE_TIME',
        priceAmount: parseOptionalFloat(formData.get('priceAmount')),
        isActive: formData.get('isActive') === 'on',
        sortOrder: parseOptionalInt(formData.get('sortOrder')) ?? 0,
    };
}

export async function createAddOnAction(_prevState: AddOnFormState | undefined, formData: FormData): Promise<AddOnFormState> {
    const fields = readAddOnFields(formData);

    if (!fields.product || !fields.name) {
        return { error: 'Product and name are required.' };
    }

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await prisma.addOn.findUnique({ where: { productId_slug: { productId: fields.product, slug } } });
    if (existing) {
        return { error: `An add-on with slug "${slug}" already exists for this product.` };
    }

    await prisma.addOn.create({
        data: {
            productId: fields.product,
            name: fields.name,
            slug,
            description: fields.description,
            pricingType: fields.pricingType,
            priceAmount: fields.priceAmount,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        },
    });

    revalidatePath('/admin/addons');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/addons');
}

export async function updateAddOnAction(
    id: string,
    _prevState: AddOnFormState | undefined,
    formData: FormData
): Promise<AddOnFormState> {
    const fields = readAddOnFields(formData);

    if (!fields.product || !fields.name) {
        return { error: 'Product and name are required.' };
    }

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await prisma.addOn.findUnique({ where: { productId_slug: { productId: fields.product, slug } } });
    if (existing && existing.id !== id) {
        return { error: `An add-on with slug "${slug}" already exists for this product.` };
    }

    await prisma.addOn.update({
        where: { id },
        data: {
            productId: fields.product,
            name: fields.name,
            slug,
            description: fields.description,
            pricingType: fields.pricingType,
            priceAmount: fields.priceAmount,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        },
    });

    revalidatePath('/admin/addons');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/addons');
}

export async function deleteAddOnAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const attachedCount = await prisma.subscriptionAddOn.count({ where: { addOnId: id } });
    if (attachedCount > 0) {
        redirect('/admin/addons?error=' + encodeURIComponent('This add-on is attached to active subscriptions and cannot be deleted. Disable it instead.'));
    }

    await prisma.addOn.delete({ where: { id } });

    revalidatePath('/admin/addons');
}

export async function toggleAddOnActiveAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const addOn = await prisma.addOn.findUnique({ where: { id } });
    if (!addOn) return;

    await prisma.addOn.update({ where: { id }, data: { isActive: !addOn.isActive } });

    revalidatePath('/admin/addons');
    revalidatePath('/dashboard/subscription');
}

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export async function updateTicketStatusAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!id || !TICKET_STATUSES.includes(status as (typeof TICKET_STATUSES)[number])) return;

    await prisma.supportTicket.update({
        where: { id },
        data: { status: status as (typeof TICKET_STATUSES)[number] },
    });

    revalidatePath('/admin/tickets');
    revalidatePath(`/admin/tickets/${id}`);
}

export async function addAdminTicketCommentAction(formData: FormData) {
    const admin = await requireAdmin();
    const ticketId = String(formData.get('ticketId') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    if (!ticketId || !body) return;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;

    await createComment(CommentEntityType.SUPPORT_TICKET, ticketId, admin.id, body);

    revalidatePath(`/admin/tickets/${ticketId}`);
}

/**
 * Pushes a plan's price into Paddle, creating it if it has none yet.
 *
 * The plan is the source of truth: whatever amount and currency an admin has
 * set here is what Paddle is made to charge. It is deliberately one direction —
 * pulling from Paddle would let a change made in their dashboard silently
 * contradict what the site displays.
 */
export async function syncPlanWithPaddleAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const plan = await prisma.plan.findUnique({
        where: { id },
        include: { product: true, currency: true },
    });
    if (!plan) return;

    const back = `/admin/plans?synced=${encodeURIComponent(plan.name)}`;
    const fail = (message: string) =>
        redirect(`/admin/plans?syncError=${encodeURIComponent(message)}`);

    if (plan.priceAmount == null) {
        fail(`${plan.name} is a custom-quote plan, so there is no price to sync.`);
        return;
    }

    try {
        const { priceId, created } = await syncPlanToPaddle({
            productLabel: plan.product.label,
            planName: plan.name,
            amount: plan.priceAmount,
            currencyCode: plan.currency?.code ?? 'USD',
            perSeat: plan.priceUnit === 'PER_USER_MONTHLY',
            existingPriceId: plan.paddlePriceId,
        });
        if (created) {
            await prisma.plan.update({ where: { id }, data: { paddlePriceId: priceId } });
        }
    } catch (error) {
        fail(error instanceof Error ? error.message : 'Paddle rejected the sync.');
        return;
    }

    revalidatePath('/admin/plans');
    redirect(back);
}
