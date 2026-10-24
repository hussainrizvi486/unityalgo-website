import { requireCustomer } from '@/lib/customer-session';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { AppStoreClient } from './store-client';
import { installKeyFor } from '@/lib/app-modules';
import { moduleKeysBySite } from '@/lib/site-modules';
import { loadPlanTiers } from '@/lib/app-plan-access';
import { upgradeTarget } from '@/lib/app-compatibility';
import { reconcilePurchases } from '@/lib/app-billing';
import type { InstallSite } from '@/components/customer/install-app-dialog';

export const metadata = { title: 'App Store' };
export default async function AppStorePage() {
    const user = await requireCustomer();
    const apps = await db
        .select({
            id: schema.appCatalog.id,
            name: schema.appCatalog.name,
            slug: schema.appCatalog.slug,
            description: schema.appCatalog.description,
            category: schema.appCatalog.category,
            iconUrl: schema.appCatalog.iconUrl,
            frappeAppName: schema.appCatalog.frappeAppName,
            appType: schema.appCatalog.appType,
            modules: schema.appCatalog.modules,
            publisher: schema.appCatalog.publisher,
            source: schema.appCatalog.source,
            compatibility: schema.appCatalog.compatibility,
            priceAmount: schema.appCatalog.priceAmount,
            priceCurrency: schema.appCatalog.priceCurrency,
            isInstallable: schema.appCatalog.isInstallable,
            minPlanId: schema.appCatalog.minPlanId,
        })
        .from(schema.appCatalog)
        .where(eq(schema.appCatalog.isActive, true))
        .orderBy(asc(schema.appCatalog.sortOrder), asc(schema.appCatalog.name));
    let available: string[] = [];
    let sites: InstallSite[] = [];
    let sitePlans = new Map<string, string | null>();
    const tiers = await loadPlanTiers();
    try {
        available = (await controller.sites.capabilities()).apps;
        const owned = (await controller.sites.list(user.id)).results;
        sitePlans = new Map(owned.map((site) => [site.id, site.plan_id ?? null]));
        const moduleKeys = await moduleKeysBySite(owned.map((site) => site.id));
        sites = owned
            .filter((site) => !['failed', 'cleanup_required', 'deleting'].includes(site.status))
            .map((site) => ({
                id: site.id,
                name: site.name,
                domain: site.domain,
                apps: [...site.apps, ...(moduleKeys.get(site.id) ?? [])],
                trial: Boolean(site.trial),
                unavailable:
                    site.status !== 'ready' ? `The site is ${site.status.replaceAll('_', ' ')}` : site.activity ? 'The site is busy' : null,
            }));
        await reconcilePurchases(user.id, owned, true);
    } catch {
        /* Browsing the catalogue works even when hosting is offline. */
    }
    return (
        <AppStoreClient
            sites={sites}
            apps={apps.map(({ source, compatibility, modules, ...app }) => ({
                ...app,
                lockedBy: Object.fromEntries(sites.flatMap((site) => {
                    const needs = upgradeTarget(app, tiers.find((tier) => tier.id === sitePlans.get(site.id)), tiers);
                    return needs ? [[site.id, { planId: needs.id, planName: needs.name }]] : [];
                })),
                installKey: installKeyFor(app),
                available: app.appType === 'module'
                    // A module entry installs nothing, so it needs no app in the image; it needs modules to switch on.
                    ? Boolean(app.isInstallable && modules.length > 0)
                    : Boolean(
                        app.isInstallable &&
                        app.frappeAppName &&
                        (source === 'github' ? compatibility === 'compatible' : available.includes(app.frappeAppName)),
                    ),
            }))}
        />
    );
}
