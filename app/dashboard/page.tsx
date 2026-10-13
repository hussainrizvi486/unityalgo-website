import { getSubscriptions } from '@/app/customer/actions';
import { requireCustomer } from '@/lib/customer-session';
import { OverviewClient } from './overview-client';
import { controller } from '@/lib/controller-client';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Dashboard' };

export default async function CustomerOverviewPage() {
    const user = await requireCustomer();
    const subscriptions = await getSubscriptions(user.id);
    const apps = await prisma.appCatalog.count({ where: { isActive: true } });
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
            appCount={apps}
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
