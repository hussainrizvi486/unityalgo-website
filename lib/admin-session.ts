import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

/**
 * Reading the admin session.
 *
 * Lives here rather than in app/admin/actions.ts because that file is marked
 * `'use server'`, where every export becomes an endpoint the browser can post
 * to. A helper that returns the admin user has no business being one, so it
 * sits in a plain server module that both the pages and the action files
 * import.
 */

/** The signed-in admin's email, or null. Does not redirect. */
export async function getCurrentAdminEmail() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await verifySessionToken(token);
    return session?.email ?? null;
}

/** Whether the request carries an admin session, for API routes that must answer 401 rather than redirect. */
export async function isAdminSession() {
    const email = await getCurrentAdminEmail();
    if (!email) return false;
    const admin = await db.query.user.findFirst({ where: eq(schema.user.email, email), columns: { role: true } });
    return admin?.role === 'ADMIN';
}

/**
 * The signed-in admin, or a redirect to the login page.
 *
 * The role is re-checked here, not just at login. proxy.ts only verifies that
 * the session token is valid, so an account demoted from ADMIN after signing in
 * would otherwise keep the admin panel until its cookie expired.
 */
export async function requireAdmin() {
    const email = await getCurrentAdminEmail();
    if (!email) redirect('/login');
    const admin = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
    if (!admin || admin.role !== 'ADMIN') redirect('/login');
    return admin;
}
