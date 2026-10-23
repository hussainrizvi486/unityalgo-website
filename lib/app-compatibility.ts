/**
 * Which plans can use an app. An app names the lowest plan that supports it (`minPlanId`); every plan at or above it
 * in the same product can use it. Tiers follow the plans' sort order, which is how the admin orders them.
 * An app with no minimum works on every plan.
 */

export interface PlanTier {
    id: string;
    name: string;
    productId: string;
    sortOrder: number;
}

export interface AppRequirement {
    minPlanId: string | null;
}

/** Plans of the same product as `plan`, lowest tier first. */
function tiersOf(plan: PlanTier, plans: PlanTier[]) {
    return plans.filter((candidate) => candidate.productId === plan.productId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function requiredPlan(app: AppRequirement, plans: PlanTier[]) {
    return app.minPlanId ? plans.find((plan) => plan.id === app.minPlanId) ?? null : null;
}

/** True when the plan can run the app. A missing or unknown requirement never blocks anything. */
export function isCompatible(app: AppRequirement, plan: PlanTier | null | undefined, plans: PlanTier[]) {
    const minimum = requiredPlan(app, plans);
    if (!minimum || !plan) return true;
    if (minimum.productId !== plan.productId) return true;
    return plan.sortOrder >= minimum.sortOrder;
}

/** The plan to upgrade to so the app works: the minimum itself, which is the cheapest plan that supports it. */
export function upgradeTarget(app: AppRequirement, plan: PlanTier | null | undefined, plans: PlanTier[]) {
    if (isCompatible(app, plan, plans)) return null;
    return requiredPlan(app, plans);
}

/** Installed apps a lower plan could not run, for refusing or warning about a downgrade. */
export function appsBlockingPlan<T extends AppRequirement>(installed: T[], target: PlanTier, plans: PlanTier[]) {
    return installed.filter((app) => !isCompatible(app, target, plans));
}

/** Tier positions are only meaningful inside one product. */
export const isLowerPlan = (from: PlanTier, to: PlanTier, plans: PlanTier[]) => {
    const tiers = tiersOf(from, plans);
    return tiers.findIndex((tier) => tier.id === to.id) < tiers.findIndex((tier) => tier.id === from.id);
};
