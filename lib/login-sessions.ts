import 'server-only';
import { headers } from 'next/headers';
import { db, schema } from '@/lib/db';
import {
    createCustomerSessionToken,
    CUSTOMER_SESSION_DURATION_SECONDS,
} from '@/lib/customer-auth';

export async function createTrackedCustomerSession(user: {
    id: string;
    email: string;
}) {
    const requestHeaders = await headers();
    const [session] = await db
        .insert(schema.loginSession)
        .values({
            userId: user.id,
            userAgent: (
                requestHeaders.get('user-agent') || 'Unknown device'
            ).slice(0, 500),
            expiresAt: new Date(
                Date.now() + CUSTOMER_SESSION_DURATION_SECONDS * 1000,
            ),
        })
        .returning();
    return createCustomerSessionToken({
        userId: user.id,
        email: user.email,
        sessionId: session.id,
    });
}
