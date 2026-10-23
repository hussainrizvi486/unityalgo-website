import 'server-only';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { appsBlockingPlan, type PlanTier } from '@/lib/app-compatibility';

export async function loadPlanTiers(): Promise<PlanTier[]> {
    const plans = await db.select({ id: schema.plan.id, name: schema.plan.name, productId: schema.plan.productId, sortOrder: schema.plan.sortOrder }).from(schema.plan);
    return plans;
}

export class PlanAccessError extends Error {}

/** Refuses a plan that cannot run an app already on the site, naming the apps so the customer knows what to remove. */
export async function assertSiteAppsFitPlan(installedFrappeApps: string[] | null | undefined, targetPlanId: string) {
    if (!installedFrappeApps?.length) return;
    const [tiers, catalog] = await Promise.all([
        loadPlanTiers(),
        db.select({ name: schema.appCatalog.name, minPlanId: schema.appCatalog.minPlanId }).from(schema.appCatalog).where(inArray(schema.appCatalog.frappeAppName, installedFrappeApps)),
    ]);
    const target = tiers.find((tier) => tier.id === targetPlanId);
    if (!target) return;
    const blocking = appsBlockingPlan(catalog, target, tiers);
    if (blocking.length) throw new PlanAccessError(`${target.name} does not support ${blocking.map((app) => app.name).join(', ')}. Remove ${blocking.length === 1 ? 'it' : 'them'} from the site first, or choose a higher plan.`);
}
