import 'server-only';
import { and, asc, eq, isNotNull, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { isCompatible, requiredPlan, type PlanTier } from '@/lib/app-compatibility';
import { formatPrice } from '@/lib/admin-format';

export interface CatalogApp {
    id: string;
    name: string;
    minPlanId: string | null;
    priceAmount: number | null;
    priceCurrency: string;
}

/** Apps a customer can install: active, installable, and verified when they come from GitHub. */
export async function loadCatalogApps(): Promise<CatalogApp[]> {
    const rows = await db
        .select({ id: schema.appCatalog.id, name: schema.appCatalog.name, minPlanId: schema.appCatalog.minPlanId, priceAmount: schema.appCatalog.priceAmount, priceCurrency: schema.appCatalog.priceCurrency, source: schema.appCatalog.source, compatibility: schema.appCatalog.compatibility })
        .from(schema.appCatalog)
        .where(and(eq(schema.appCatalog.isActive, true), eq(schema.appCatalog.isInstallable, true), or(isNotNull(schema.appCatalog.frappeAppName), eq(schema.appCatalog.appType, 'module'))))
        .orderBy(asc(schema.appCatalog.sortOrder), asc(schema.appCatalog.name));
    return rows.filter((row) => row.source !== 'github' || row.compatibility === 'compatible').map(({ source, compatibility, ...app }) => (void source, void compatibility, app));
}

export const appPriceLabel = (app: Pick<CatalogApp, 'priceAmount' | 'priceCurrency'>) =>
    (app.priceAmount ?? 0) > 0 ? `${formatPrice(app.priceAmount!, app.priceCurrency)}/mo per site` : 'Free';

/** The apps a plan can run, and the ones that need a higher plan (with that plan's name). */
export function splitAppsForPlan(apps: CatalogApp[], plan: PlanTier, tiers: PlanTier[]) {
    const compatible = apps.filter((app) => isCompatible(app, plan, tiers));
    const locked = apps.filter((app) => !isCompatible(app, plan, tiers)).flatMap((app) => {
        const needs = requiredPlan(app, tiers);
        return needs ? [{ ...app, requiredPlanId: needs.id, requiredPlanName: needs.name }] : [];
    });
    return { compatible, locked };
}
