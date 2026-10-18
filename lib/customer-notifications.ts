import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { CustomerSite } from '@/lib/controller-client';

export async function recordSiteNotification(
    userId: string,
    site: CustomerSite,
) {
    if (!['ready', 'failed', 'cleanup_required'].includes(site.status)) return;
    const eventKey = `site:${site.id}:${site.attempt}:${site.status}`;
    await db
        .insert(schema.notification)
        .values({
            userId,
            eventKey,
            title:
                site.status === 'ready'
                    ? `${site.name} is ready`
                    : `${site.name} needs attention`,
            body: site.message,
            href: `/dashboard/sites/${site.id}`,
        })
        .onConflictDoNothing({ target: [schema.notification.userId, schema.notification.eventKey] });
}

export async function listNotifications(userId: string) {
    const [items, unread] = await Promise.all([
        db.query.notification.findMany({
            where: eq(schema.notification.userId, userId),
            orderBy: desc(schema.notification.createdAt),
            limit: 20,
        }),
        db.$count(schema.notification, and(eq(schema.notification.userId, userId), isNull(schema.notification.readAt))),
    ]);
    return {
        unread,
        items: items.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            href: item.href,
            read: Boolean(item.readAt),
            createdAt: item.createdAt.toISOString(),
        })),
    };
}
