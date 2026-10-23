import { getSubscriptions } from '@/app/customer/actions';
import { requireCustomer } from '@/lib/customer-session';
import { OverviewClient } from './overview-client';
import { controller } from '@/lib/controller-client';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { computeMonthlyTotal } from '@/lib/pricing';

export const metadata = { title: 'Dashboard' };

export default async function CustomerOverviewPage() {
    const user = await requireCustomer();
    const subscriptions = await getSubscriptions(user.id);
    const [notificationTotal, unreadNotifications, appPurchases] = await Promise.all([
        db.$count(schema.notification, eq(schema.notification.userId, user.id)),
        db.$count(schema.notification, and(eq(schema.notification.userId, user.id), isNull(schema.notification.readAt))),
        db.query.appPurchase.findMany({
            where: and(eq(schema.appPurchase.userId, user.id), eq(schema.appPurchase.status, 'ACTIVE'), eq(schema.appPurchase.billingMode, 'paddle')),
        }),
    ]);
    const spend = new Map<string, number>();
    const charge = (code: string, amount: number) => spend.set(code, (spend.get(code) ?? 0) + amount);
    for (const subscription of subscriptions) {
        if (subscription.status !== 'ACTIVE' && subscription.status !== 'PAST_DUE') continue;
        const total = computeMonthlyTotal(subscription.plan, subscription.addOns.map((row) => row.addOn));
        if (total) charge(subscription.plan.currency?.code ?? 'USD', total);
    }
    for (const purchase of appPurchases) charge(purchase.currency, purchase.priceAmount);
    let siteStats = null;
    try {
        const sites = (await controller.sites.list(user.id)).results;
        siteStats = {
            total: sites.length,
            ready: sites.filter((site) => site.status === 'ready').length,
            provisioning: sites.filter(
                (site) =>
                    !['ready', 'failed', 'cleanup_required'].includes(
                        site.status,
                    ),
            ).length,
        };
    } catch {
        /* The account overview stays usable during hosting outages. */
    }

    return (
        <OverviewClient
            siteStats={siteStats}
            monthlySpend={[...spend].map(([currency, amount]) => ({ currency, amount }))}
            notifications={{ total: notificationTotal, unread: unreadNotifications }}
            profile={{
                firstName: user.firstName || user.name || 'Customer',
                lastName: user.lastName || '',
                email: user.email,
            }}
            subscriptions={subscriptions.map((subscription) => ({
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                plan: subscription.plan,
                addOns: subscription.addOns.map((row) => row.addOn),
            }))}
        />
    );
}
