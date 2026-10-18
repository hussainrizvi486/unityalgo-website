import type { AddOn, AddOnPricingType, Currency, Plan, PriceUnit } from '@/db/types';
import { DEFAULT_CURRENCY, formatCurrencyAmount } from '@/lib/currency';

export type PriceCurrency = Pick<Currency, 'symbol' | 'numberFormat'> & { code?: string };
type PlanPricing = Pick<Plan, 'priceAmount' | 'priceUnit'> & { currency?: PriceCurrency | null };

function formatMoney(amount: number, currency?: PriceCurrency | null) {
    const c = currency ?? DEFAULT_CURRENCY;
    let text = formatCurrencyAmount(amount, c);
    if (Number.isInteger(amount)) text = text.replace(/[.,]0+$/, '');
    return /[A-Za-z]$/.test(c.symbol) ? text.replace(c.symbol, `${c.symbol} `) : text;
}

export function formatPlanPrice(plan: PlanPricing) {
    if (plan.priceAmount == null) return 'Custom quote';
    const suffix: Record<PriceUnit, string> = {
        PER_USER_MONTHLY: '/user/mo',
        FLAT_MONTHLY: '/mo',
    };
    return `${formatMoney(plan.priceAmount, plan.currency)}${suffix[plan.priceUnit]}`;
}

export function formatAddOnPrice(addOn: Pick<AddOn, 'priceAmount' | 'pricingType'>) {
    if (addOn.priceAmount == null) return 'Custom quote';
    const suffix: Record<AddOnPricingType, string> = {
        FLAT_MONTHLY: '/mo',
        ONE_TIME: ' one-time',
    };
    return `${formatMoney(addOn.priceAmount)}${suffix[addOn.pricingType]}`;
}

export function formatTransactionFee(percent: number | null) {
    if (percent == null) return null;
    return `${percent}% transaction fee`;
}

export function formatCurrency(amount: number, currency?: PriceCurrency | null) {
    return formatMoney(amount, currency);
}

export function computeMonthlyTotal(
    plan: PlanPricing,
    addOns: Array<Pick<AddOn, 'priceAmount' | 'pricingType'>>,
): number | null {
    if (plan.priceAmount == null || plan.priceUnit !== 'FLAT_MONTHLY') return null;
    const addOnTotal = addOns.reduce(
        (sum, addOn) => (addOn.pricingType === 'FLAT_MONTHLY' && addOn.priceAmount != null ? sum + addOn.priceAmount : sum),
        0,
    );
    return plan.priceAmount + addOnTotal;
}

export function formatProductName(product: { label: string } | string) {
    return typeof product === 'string' ? product : product.label;
}
