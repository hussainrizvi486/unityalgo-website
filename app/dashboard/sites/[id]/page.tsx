import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { Notice } from '@/components/ui/notice';
import { SiteStatus } from './site-status';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { listAlgoSuitePlans } from '@/lib/products';
import { formatPlanPrice } from '@/lib/pricing';
export default async function SiteDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await requireCustomer();
    const { id } = await params;
    let site;
    try {
        site = await controller.sites.get(id, user.id);
    } catch (error) {
        if (error instanceof ControllerError && error.status === 404)
            notFound();
        return (
            <Notice tone="warning">
                Site hosting is unavailable. Your site has not been changed. Try
                again shortly.
            </Notice>
        );
    }
    await recordSiteNotification(user.id, site);
    const applications = site.apps.length
        ? await db
              .select({ name: schema.appCatalog.name, frappeAppName: schema.appCatalog.frappeAppName })
              .from(schema.appCatalog)
              .where(inArray(schema.appCatalog.frappeAppName, site.apps))
        : [];
    const applicationNames = Object.fromEntries(
        applications
            .filter((app) => app.frappeAppName !== 'erpnext')
            .map((app) => [app.frappeAppName!, app.name]),
    );
    const plans = await listAlgoSuitePlans();
    return (
        <SiteStatus
            initial={site}
            plans={plans.map((plan) => ({
                id: plan.id,
                name: plan.name,
                price: formatPlanPrice(plan),
                users: plan.userLimit,
                vcpu: plan.vcpu,
                ramMb: plan.ramMb,
                storageGb: plan.storageGb,
            }))}
            applicationNames={{
                ...applicationNames,
                erpnext: 'ERPNext',
                frappe: 'Frappe',
            }}
        />
    );
}
