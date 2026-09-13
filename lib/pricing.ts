import type { AddOn, AddOnPricingType, Plan, PriceUnit } from '@prisma/client';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatPlanPrice(plan: Pick<Plan, 'priceAmount' | 'priceUnit'>) {
    if (plan.priceAmount == null) return 'Custom quote';
    const suffix: Record<PriceUnit, string> = {
        PER_USER_MONTHLY: '/user/mo',
        FLAT_MONTHLY: '/mo',
    };
    return `${currency.format(plan.priceAmount)}${suffix[plan.priceUnit]}`;
}

export function formatAddOnPrice(addOn: Pick<AddOn, 'priceAmount' | 'pricingType'>) {
    if (addOn.priceAmount == null) return 'Custom quote';
    const suffix: Record<AddOnPricingType, string> = {
        FLAT_MONTHLY: '/mo',
        ONE_TIME: ' one-time',
    };
    return `${currency.format(addOn.priceAmount)}${suffix[addOn.pricingType]}`;
}

export function formatTransactionFee(percent: number | null) {
    if (percent == null) return null;
    return `${percent}% transaction fee`;
}

export function formatCurrency(amount: number) {
    return currency.format(amount);
}

// Only meaningful for flat-monthly plans — a per-user plan's total depends
// on seat count, which isn't tracked yet, so callers should hide the total
// line rather than show a misleading number for those.
export function computeMonthlyTotal(
    plan: Pick<Plan, 'priceAmount' | 'priceUnit'>,
    addOns: Array<Pick<AddOn, 'priceAmount' | 'pricingType'>>,
): number | null {
    if (plan.priceAmount == null || plan.priceUnit !== 'FLAT_MONTHLY') return null;
    const addOnTotal = addOns.reduce(
        (sum, addOn) => (addOn.pricingType === 'FLAT_MONTHLY' && addOn.priceAmount != null ? sum + addOn.priceAmount : sum),
        0,
    );
    return plan.priceAmount + addOnTotal;
}

/**
 * Product display name.
 *
 * Labels live on the `Product` row now, so callers that already loaded the
 * relation should read `product.label` directly; this only covers the places
 * holding a bare id.
 */
export function formatProductName(product: { label: string } | string) {
    return typeof product === 'string' ? product : product.label;
}
