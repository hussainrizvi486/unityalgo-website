'use server';

import { parsePlanMetadataText } from '@/lib/plan-metadata';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/auth';
import { CommentEntityType, createComment } from '@/lib/comments';
import { getCurrentAdminEmail, requireAdmin } from '@/lib/admin-session';
import { PaddleApiError, syncPlanToPaddle } from '@/lib/paddle-catalog';

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

    const existing = await db.query.post.findFirst({ where: eq(schema.post.slug, slug) });
    if (existing) {
        return { error: `Slug "${slug}" is already in use.` };
    }

    await db.insert(schema.post).values({
            title,
            slug,
            excerpt,
            content,
            coverImage,
            published,
            publishedAt: published ? new Date() : null,
            metaTitle,
            metaDescription,
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

    const existing = await db.query.post.findFirst({ where: eq(schema.post.slug, slug) });
    if (existing && existing.id !== id) {
        return { error: `Slug "${slug}" is already in use.` };
    }

    const current = await db.query.post.findFirst({ where: eq(schema.post.id, id) });

    await db.update(schema.post).set({
            title,
            slug,
            excerpt,
            content,
            coverImage,
            published,
            publishedAt: published ? current?.publishedAt ?? new Date() : null,
            metaTitle,
            metaDescription,
        }).where(eq(schema.post.id, id));

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    revalidatePath(`/blog/${slug}`);
    redirect('/admin/blogs');
}

export async function deletePostAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const [post] = await db.delete(schema.post).where(eq(schema.post.id, id)).returning({ slug: schema.post.slug });

    revalidatePath('/admin/blogs');
    revalidatePath('/blog');
    if (post) revalidatePath(`/blog/${post.slug}`);
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

    await db.insert(schema.contactSubmission).values(fields);

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

    await db.update(schema.contactSubmission).set(fields).where(eq(schema.contactSubmission.id, id));

    revalidatePath('/admin/contacts');
    redirect('/admin/contacts');
}

export async function deleteContactSubmissionAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    await db.delete(schema.contactSubmission).where(eq(schema.contactSubmission.id, id));

    revalidatePath('/admin/contacts');
}

export async function togglePublishAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const post = await db.query.post.findFirst({ where: eq(schema.post.id, id) });
    if (!post) return;

    const nextPublished = !post.published;

    await db.update(schema.post).set({
            published: nextPublished,
            publishedAt: nextPublished ? post.publishedAt ?? new Date() : post.publishedAt,
        }).where(eq(schema.post.id, id));

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

    const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
    if (existing) {
        return { error: `A user with email "${email}" already exists.` };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(schema.user).values({ email, name, passwordHash, role: 'ADMIN' });

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

    const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
    if (existing && existing.id !== id) {
        return { error: `A user with email "${email}" already exists.` };
    }

    await db.update(schema.user).set({ email, name }).where(eq(schema.user.id, id));

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

    await db.update(schema.user).set({ passwordHash }).where(eq(schema.user.id, id));

    return { success: true };
}

export async function deleteUserAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const [user, currentEmail] = await Promise.all([
        db.query.user.findFirst({ where: eq(schema.user.id, id) }),
        getCurrentAdminEmail(),
    ]);

    if (!user) return;

    if (user.email === currentEmail) {
        redirect('/admin/users?error=' + encodeURIComponent('You cannot delete your own account.'));
    }

    if (user.role === 'ADMIN') {
        const totalAdmins = await db.$count(schema.user, eq(schema.user.role, 'ADMIN'));
        if (totalAdmins <= 1) {
            redirect('/admin/users?error=' + encodeURIComponent('Cannot delete the last remaining admin user.'));
        }
    }

    await db.delete(schema.user).where(eq(schema.user.id, id));

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
        paddlePriceId: String(formData.get('paddlePriceId') ?? '').trim() || null,
        currencyId: String(formData.get('currencyId') ?? '').trim() || null,
        userLimit: parseOptionalInt(formData.get('userLimit')),
        vcpu: parseOptionalFloat(formData.get('vcpu')),
        ramMb: parseOptionalInt(formData.get('ramMb')),
        storageGb: parseOptionalInt(formData.get('storageGb')),
        // 0 or blank = no trial. Capped so a typo cannot hand out years of free hosting.
        trialDays: (() => { const days = parseOptionalInt(formData.get('trialDays')); return days && days > 0 ? Math.min(days, 365) : null; })(),
        features: parseFeatureLines(formData.get('features')),
        metadataText: String(formData.get('metadata') ?? ''),
        isActive: formData.get('isActive') === 'on',
        sortOrder: parseOptionalInt(formData.get('sortOrder')) ?? 0,
    };
}

export async function createPlanAction(_prevState: PlanFormState | undefined, formData: FormData): Promise<PlanFormState> {
    const fields = readPlanFields(formData);

    if (!fields.product || !fields.name) {
        return { error: 'Product and name are required.' };
    }

    const metadata = parsePlanMetadataText(fields.metadataText);
    if (!metadata.ok) return { error: metadata.error };

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await db.query.plan.findFirst({ where: and(eq(schema.plan.productId, fields.product), eq(schema.plan.slug, slug)) });
    if (existing) {
        return { error: `A plan with slug "${slug}" already exists for this product.` };
    }

    await db.insert(schema.plan).values({
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
            vcpu: fields.vcpu,
            ramMb: fields.ramMb,
            storageGb: fields.storageGb,
            trialDays: fields.trialDays,
            features: fields.features,
            metadata: metadata.value,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
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

    const metadata = parsePlanMetadataText(fields.metadataText);
    if (!metadata.ok) return { error: metadata.error };

    const slug = slugify(fields.slugInput || fields.name);

    const existing = await db.query.plan.findFirst({ where: and(eq(schema.plan.productId, fields.product), eq(schema.plan.slug, slug)) });
    if (existing && existing.id !== id) {
        return { error: `A plan with slug "${slug}" already exists for this product.` };
    }

    await db.update(schema.plan).set({
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
            vcpu: fields.vcpu,
            ramMb: fields.ramMb,
            storageGb: fields.storageGb,
            trialDays: fields.trialDays,
            features: fields.features,
            metadata: metadata.value,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        }).where(eq(schema.plan.id, id));

    revalidatePath('/admin/plans');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/plans');
}

export async function deletePlanAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const subscriberCount = await db.$count(schema.subscription, eq(schema.subscription.planId, id));
    if (subscriberCount > 0) {
        redirect('/admin/plans?error=' + encodeURIComponent('This plan still has active subscriptions and cannot be deleted. Disable it instead.'));
    }

    await db.delete(schema.plan).where(eq(schema.plan.id, id));

    revalidatePath('/admin/plans');
}

export async function togglePlanActiveAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const plan = await db.query.plan.findFirst({ where: eq(schema.plan.id, id) });
    if (!plan) return;

    await db.update(schema.plan).set({ isActive: !plan.isActive }).where(eq(schema.plan.id, id));

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

    const existing = await db.query.addOn.findFirst({ where: and(eq(schema.addOn.productId, fields.product), eq(schema.addOn.slug, slug)) });
    if (existing) {
        return { error: `An add-on with slug "${slug}" already exists for this product.` };
    }

    await db.insert(schema.addOn).values({
            productId: fields.product,
            name: fields.name,
            slug,
            description: fields.description,
            pricingType: fields.pricingType,
            priceAmount: fields.priceAmount,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
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

    const existing = await db.query.addOn.findFirst({ where: and(eq(schema.addOn.productId, fields.product), eq(schema.addOn.slug, slug)) });
    if (existing && existing.id !== id) {
        return { error: `An add-on with slug "${slug}" already exists for this product.` };
    }

    await db.update(schema.addOn).set({
            productId: fields.product,
            name: fields.name,
            slug,
            description: fields.description,
            pricingType: fields.pricingType,
            priceAmount: fields.priceAmount,
            isActive: fields.isActive,
            sortOrder: fields.sortOrder,
        }).where(eq(schema.addOn.id, id));

    revalidatePath('/admin/addons');
    revalidatePath('/dashboard/subscription');
    redirect('/admin/addons');
}

export async function deleteAddOnAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const attachedCount = await db.$count(schema.subscriptionAddOn, eq(schema.subscriptionAddOn.addOnId, id));
    if (attachedCount > 0) {
        redirect('/admin/addons?error=' + encodeURIComponent('This add-on is attached to active subscriptions and cannot be deleted. Disable it instead.'));
    }

    await db.delete(schema.addOn).where(eq(schema.addOn.id, id));

    revalidatePath('/admin/addons');
}

export async function toggleAddOnActiveAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const addOn = await db.query.addOn.findFirst({ where: eq(schema.addOn.id, id) });
    if (!addOn) return;

    await db.update(schema.addOn).set({ isActive: !addOn.isActive }).where(eq(schema.addOn.id, id));

    revalidatePath('/admin/addons');
    revalidatePath('/dashboard/subscription');
}

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export async function updateTicketStatusAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!id || !TICKET_STATUSES.includes(status as (typeof TICKET_STATUSES)[number])) return;

    await db.update(schema.supportTicket).set({ status: status as (typeof TICKET_STATUSES)[number] }).where(eq(schema.supportTicket.id, id));

    revalidatePath('/admin/tickets');
    revalidatePath(`/admin/tickets/${id}`);
}

export async function addAdminTicketCommentAction(formData: FormData) {
    const admin = await requireAdmin();
    const ticketId = String(formData.get('ticketId') ?? '');
    const body = String(formData.get('body') ?? '').trim();
    if (!ticketId || !body) return;

    const ticket = await db.query.supportTicket.findFirst({ where: eq(schema.supportTicket.id, ticketId) });
    if (!ticket) return;

    await createComment(CommentEntityType.SUPPORT_TICKET, ticketId, admin.id, body);

    revalidatePath(`/admin/tickets/${ticketId}`);
}

export async function syncPlanWithPaddleAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const plan = await db.query.plan.findFirst({
        where: eq(schema.plan.id, id),
        with: { product: true, currency: true },
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
            await db.update(schema.plan).set({ paddlePriceId: priceId }).where(eq(schema.plan.id, id));
        }
    } catch (error) {
        if (error instanceof PaddleApiError) {
            console.error('[paddle] Plan catalog sync failed', {
                planId: id, status: error.status, code: error.code, requestId: error.requestId,
            });
        }
        fail(error instanceof Error ? error.message : 'Paddle rejected the sync.');
        return;
    }

    revalidatePath('/admin/plans');
    redirect(back);
}
