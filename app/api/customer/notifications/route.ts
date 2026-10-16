import { getCustomerSession } from '@/lib/customer-session';
import { listNotifications } from '@/lib/customer-notifications';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    return Response.json(await listNotifications(session.userId), {
        headers: { 'Cache-Control': 'private, no-store' },
    });
}
export async function POST(request: Request) {
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    const session = await getCustomerSession();
    if (!session)
        return Response.json({ error: 'Sign in required.' }, { status: 401 });
    let data;
    try {
        data = await request.json();
    } catch {
        return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
        return Response.json({ error: 'Invalid request.' }, { status: 400 });
    if (data.all !== true && typeof data.id !== 'string')
        return Response.json(
            { error: 'A notification id is required.' },
            { status: 400 },
        );
    await db
        .update(schema.notification)
        .set({ readAt: new Date() })
        .where(
            and(
                eq(schema.notification.userId, session.userId),
                isNull(schema.notification.readAt),
                // Everything unread, or just the one the user opened.
                data.all === true ? undefined : eq(schema.notification.id, data.id),
            ),
        );
    return Response.json(await listNotifications(session.userId));
}
