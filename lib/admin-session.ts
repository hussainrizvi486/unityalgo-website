import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

/** The signed-in admin's email, or null. Does not redirect. */
export async function getCurrentAdminEmail() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await verifySessionToken(token);
    return session?.email ?? null;
}

export async function isAdminSession() {
    const email = await getCurrentAdminEmail();
    if (!email) return false;
    const admin = await db.query.user.findFirst({ where: eq(schema.user.email, email), columns: { role: true } });
    return admin?.role === 'ADMIN';
}

export async function requireAdmin() {
    const email = await getCurrentAdminEmail();
    if (!email) redirect('/login');
    const admin = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
    if (!admin || admin.role !== 'ADMIN') redirect('/login');
    return admin;
}
