import 'server-only';
import { moneyToMinor } from '@/lib/billing-rules';

export class PaddleApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly code?: string, public readonly requestId?: string, public readonly validationFields: readonly string[] = []) {
        super(message);
        this.name = 'PaddleApiError';
    }
}

function apiBase() {
    return process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';
}

export async function paddleRequest(path: string, init?: RequestInit) {
    const key = process.env.PADDLE_API_KEY;
    if (!key) throw new Error('PADDLE_API_KEY is not set.');

    const response = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json', 'Paddle-Version': '1', ...(init?.headers ?? {}) },
        cache: 'no-store',
        signal: init?.signal ?? AbortSignal.timeout(20_000),
    });
    const body = await response.json() as {
        data?: unknown;
        error?: { detail?: string; code?: string; errors?: Array<{ field?: string; message?: string }> };
        meta?: { request_id?: string };
    };
    if (!response.ok) {
        const details = Array.isArray(body.error?.errors) ? body.error.errors
            .filter((error) => typeof error.message === 'string')
            .slice(0, 5)
            .map((error) => `${error.field ? `${error.field}: ` : ''}${error.message}`) : [];
        const message = [body.error?.detail ?? `Paddle returned ${response.status}`, ...details].join(' ');
        throw new PaddleApiError(message, response.status, body.error?.code, body.meta?.request_id, Array.isArray(body.error?.errors) ? body.error.errors.flatMap((error) => typeof error.field === 'string' ? [error.field] : []) : []);
    }
    return body.data;
}

interface SyncInput {
    productLabel: string;
    planName: string;
    /** Major units — 49 means $49.00. */
    amount: number;
    currencyCode: string;
    perSeat: boolean;
    existingPriceId: string | null;
}

export async function syncPlanToPaddle(input: SyncInput): Promise<{ priceId: string; created: boolean }> {
    const amountMinor = moneyToMinor(input.amount, input.currencyCode);

    if (input.existingPriceId) {
        const current = await paddleRequest(`/prices/${input.existingPriceId}`) as {
            unit_price?: { currency_code?: string };
        };
        const existingCurrency = current.unit_price?.currency_code;
        if (existingCurrency && existingCurrency !== input.currencyCode) {
            throw new Error(
                `That Paddle price is in ${existingCurrency} and this plan is in ${input.currencyCode}. `
                + 'Paddle cannot change a price’s currency — clear the price ID to create a new one.',
            );
        }
        await paddleRequest(`/prices/${input.existingPriceId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                description: `${input.productLabel} ${input.planName}`,
                unit_price: { amount: amountMinor, currency_code: input.currencyCode },
            }),
        });
        return { priceId: input.existingPriceId, created: false };
    }

    // No price yet: find or create the product, then the price under it.
    const products = await paddleRequest('/products?per_page=100&status=active') as Array<{ id: string; name: string }>;
    let product = products.find((p) => p.name === input.productLabel);
    if (!product) {
        product = await paddleRequest('/products', {
            method: 'POST',
            body: JSON.stringify({
                name: input.productLabel,
                tax_category: 'standard',
                description: `${input.productLabel} subscription plans`,
            }),
        }) as { id: string; name: string };
    }

    const price = await paddleRequest('/prices', {
        method: 'POST',
        body: JSON.stringify({
            product_id: product.id,
            description: `${input.productLabel} ${input.planName}`,
            unit_price: { amount: amountMinor, currency_code: input.currencyCode },
            billing_cycle: { interval: 'month', frequency: 1 },
            quantity: input.perSeat ? { minimum: 1, maximum: 1000 } : { minimum: 1, maximum: 1 },
        }),
    }) as { id: string };

    return { priceId: price.id, created: true };
}

interface AppSyncInput {
    appName: string;
    /** Major units: 5 means $5.00 a month. */
    amount: number;
    currencyCode: string;
    existingPriceId: string | null;
}

export async function syncAppToPaddle(input: AppSyncInput): Promise<{ priceId: string; created: boolean }> {
    const amountMinor = moneyToMinor(input.amount, input.currencyCode);
    if (input.existingPriceId) {
        const current = (await paddleRequest(`/prices/${input.existingPriceId}`)) as { unit_price?: { currency_code?: string } };
        const existing = current.unit_price?.currency_code;
        if (existing && existing !== input.currencyCode) {
            throw new Error(`That Paddle price is in ${existing} and this app is in ${input.currencyCode}. Clear the price ID to create a new one.`);
        }
        await paddleRequest(`/prices/${input.existingPriceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ description: `App: ${input.appName}`, unit_price: { amount: amountMinor, currency_code: input.currencyCode } }),
        });
        return { priceId: input.existingPriceId, created: false };
    }

    const label = 'UnityAlgo apps';
    const products = (await paddleRequest('/products?per_page=100&status=active')) as Array<{ id: string; name: string }>;
    let product = products.find((p) => p.name === label);
    if (!product) {
        product = (await paddleRequest('/products', {
            method: 'POST',
            body: JSON.stringify({ name: label, tax_category: 'standard', description: 'Paid applications installed on customer sites' }),
        })) as { id: string; name: string };
    }
    const price = (await paddleRequest('/prices', {
        method: 'POST',
        body: JSON.stringify({
            product_id: product.id,
            description: `App: ${input.appName}`,
            unit_price: { amount: amountMinor, currency_code: input.currencyCode },
            billing_cycle: { interval: 'month', frequency: 1 },
            quantity: { minimum: 1, maximum: 1000 },
        }),
    })) as { id: string };
    return { priceId: price.id, created: true };
}
