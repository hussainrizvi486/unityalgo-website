import 'server-only';
import { prisma } from '@/lib/db';
import type { CustomerSite } from '@/lib/controller-client';

export async function recordSiteNotification(
    userId: string,
    site: CustomerSite,
) {
    if (!['ready', 'failed', 'cleanup_required'].includes(site.status)) return;
    const eventKey = `site:${site.id}:${site.status}:${site.updated_at}`;
    await prisma.notification.upsert({
        where: { userId_eventKey: { userId, eventKey } },
        update: {},
        create: {
            userId,
            eventKey,
            title:
                site.status === 'ready'
                    ? `${site.name} is ready`
                    : `${site.name} needs attention`,
            body: site.message,
            href: `/dashboard/sites/${site.id}`,
        },
    });
}

export async function listNotifications(userId: string) {
    const [items, unread] = await Promise.all([
        prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
        prisma.notification.count({ where: { userId, readAt: null } }),
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
