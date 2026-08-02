'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSessionToken, verifySessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from '@/lib/auth';

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');

    const adminUser = await prisma.adminUser.findUnique({ where: { email } });
    if (!adminUser) {
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
    redirect('/admin/login');
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

async function getCurrentAdminEmail() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await verifySessionToken(token);
    return session?.email ?? null;
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

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
        return { error: `A user with email "${email}" already exists.` };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.adminUser.create({ data: { email, name, passwordHash } });

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

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
        return { error: `A user with email "${email}" already exists.` };
    }

    await prisma.adminUser.update({ where: { id }, data: { email, name } });

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

    await prisma.adminUser.update({ where: { id }, data: { passwordHash } });

    return { success: true };
}

export async function deleteUserAction(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const [user, currentEmail, totalUsers] = await Promise.all([
        prisma.adminUser.findUnique({ where: { id } }),
        getCurrentAdminEmail(),
        prisma.adminUser.count(),
    ]);

    if (!user) return;

    if (user.email === currentEmail) {
        redirect('/admin/users?error=' + encodeURIComponent('You cannot delete your own account.'));
    }

    if (totalUsers <= 1) {
        redirect('/admin/users?error=' + encodeURIComponent('Cannot delete the last remaining admin user.'));
    }

    await prisma.adminUser.delete({ where: { id } });

    revalidatePath('/admin/users');
}
