import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { Notice } from '@/components/ui/notice';
import { SiteStatus } from './site-status';
import { reconcilePurchases } from '@/lib/app-billing';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
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
    await reconcilePurchases(user.id, [site]).catch(() => undefined);
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
    // What can be added to this site from the App Store (free or paid).
    const catalogue = await db
        .select({
            id: schema.appCatalog.id,
            isInstallable: schema.appCatalog.isInstallable,
            name: schema.appCatalog.name,
            description: schema.appCatalog.description,
            frappeAppName: schema.appCatalog.frappeAppName,
            source: schema.appCatalog.source,
            compatibility: schema.appCatalog.compatibility,
            priceAmount: schema.appCatalog.priceAmount,
            priceCurrency: schema.appCatalog.priceCurrency,
        })
        .from(schema.appCatalog)
        .where(and(eq(schema.appCatalog.isActive, true), isNotNull(schema.appCatalog.frappeAppName)))
        .orderBy(asc(schema.appCatalog.sortOrder), asc(schema.appCatalog.name));
    let shipped: string[] = [];
    try {
        shipped = (await controller.sites.capabilities()).apps;
    } catch {
        /* the list of installable apps simply stays short */
    }
    const known = Object.fromEntries(
        catalogue.map((app) => [app.frappeAppName!, { id: app.id, name: app.name, priceAmount: app.priceAmount, priceCurrency: app.priceCurrency }]),
    );
    const installable = catalogue
        .filter((app) => app.isInstallable)
        .filter((app) => (app.source === 'github' ? app.compatibility === 'compatible' : shipped.includes(app.frappeAppName!)))
        .map((app) => ({
            id: app.id,
            name: app.name,
            description: app.description,
            frappeAppName: app.frappeAppName!,
            priceAmount: app.priceAmount,
            priceCurrency: app.priceCurrency,
        }));
    const plans = await listAlgoSuitePlans();
    return (
        <SiteStatus
            initial={site}
            installable={installable}
            known={known}
            plans={plans.filter((plan) => plan.priceAmount != null && !!plan.paddlePriceId).map((plan) => ({
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
                erpnext: 'AlgoSuite ERP',
                frappe: 'AlgoSuite platform',
            }}
        />
    );
}
