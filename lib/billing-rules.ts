/** Pure billing rules shared by the service and regression tests. */
export interface ProviderSubscription {
    id: string;
    customer_id: string;
    status: string;
    updated_at: string;
    scheduled_change: unknown;
    custom_data?: Record<string, unknown> | null;
    items: Array<{ price: { id: string }; quantity: number }>;
    [key: string]: unknown;
}

export function planChangeItems(current: ProviderSubscription, oldPriceId: string, newPriceId: string) {
    if (current.status !== 'active') throw new Error('Only an active subscription can change plans.');
    if (current.scheduled_change) throw new Error('Resolve the scheduled subscription change before switching plans.');
    const base = current.items.filter((item) => item.price.id === oldPriceId);
    if (base.length !== 1) throw new Error('The subscription plan changed. Refresh and try again.');
    if (oldPriceId === newPriceId || current.items.some((item) => item.price.id === newPriceId)) {
        throw new Error('This plan is already on the subscription.');
    }
    return current.items.map((item) => ({
        price_id: item.price.id === oldPriceId ? newPriceId : item.price.id,
        quantity: item.quantity,
    }));
}

export function providerStatus(status: unknown) {
    switch (status) {
        case 'active': return 'ACTIVE' as const;
        case 'trialing': return 'TRIAL' as const;
        case 'past_due': return 'PAST_DUE' as const;
        case 'paused': return 'PAUSED' as const;
        case 'canceled': return 'CANCELED' as const;
        default: throw new Error('Unrecognized Paddle subscription status.');
    }
}

export function currencyDigits(currency: string) {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function moneyFromMinor(value: unknown, currency: string): number | null {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n / (10 ** currencyDigits(currency)) : null;
}
export function moneyToMinor(value: number, currency: string) {
    const n = Math.round(value * 10 ** currencyDigits(currency));
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid monetary amount.');
    return String(n);
}
