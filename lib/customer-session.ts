import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { User } from '@/db/types';
import { db, schema } from '@/lib/db';
import {
    verifyCustomerSessionToken,
    CUSTOMER_SESSION_COOKIE,
} from '@/lib/customer-auth';

/** Revocation is checked in the database on every authenticated request. */
export async function getCustomerSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyCustomerSessionToken(token);
    if (!payload?.sessionId || typeof payload.userId !== 'string') return null;
    // Valid, unrevoked, unexpired, and still owned by a CUSTOMER account.
    const [row] = await db
        .select({ session: schema.loginSession })
        .from(schema.loginSession)
        .innerJoin(schema.user, eq(schema.user.id, schema.loginSession.userId))
        .where(
            and(
                eq(schema.loginSession.id, payload.sessionId),
                eq(schema.loginSession.userId, payload.userId),
                isNull(schema.loginSession.revokedAt),
                gt(schema.loginSession.expiresAt, new Date()),
                eq(schema.user.role, 'CUSTOMER'),
            ),
        )
        .limit(1);
    const session = row?.session;
    if (!session) return null;
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
        await db
            .update(schema.loginSession)
            .set({ lastSeenAt: new Date() })
            .where(and(eq(schema.loginSession.id, session.id), isNull(schema.loginSession.revokedAt)));
    }
    return { ...payload, sessionId: session.id };
}

export async function requireCustomer(): Promise<User> {
    const session = await getCustomerSession();
    if (!session) redirect('/login');

    const user = await db.query.user.findFirst({
        where: eq(schema.user.id, session.userId),
    });
    if (!user || user.role !== 'CUSTOMER') redirect('/login');

    return user;
}

export async function requireCustomerSession() {
    const session = await getCustomerSession();
    if (!session) redirect('/login');
    return session;
}
