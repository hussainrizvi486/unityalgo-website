import 'server-only';

/**
 * The slice of Paddle's catalogue API this app writes to.
 *
 * Kept separate from lib/paddle.ts, which is only concerned with verifying
 * incoming webhooks. That module runs on every notification; this one runs
 * when an admin presses a button, and needs an API key rather than a signing
 * secret.
 */

function apiBase() {
    // The sandbox and production catalogues are different accounts entirely, so
    // this follows the same switch the browser SDK uses.
    return process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';
}

async function paddle(path: string, init?: RequestInit) {
    const key = process.env.PADDLE_API_KEY;
    if (!key) throw new Error('PADDLE_API_KEY is not set.');

    const response = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
        cache: 'no-store',
    });
    const body = await response.json() as { data?: unknown; error?: { detail?: string } };
    if (!response.ok) {
        throw new Error(body.error?.detail ?? `Paddle returned ${response.status}`);
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

/**
 * Pushes a plan's price to Paddle, creating it if it does not exist yet.
 *
 * Paddle prices are immutable in the ways that matter — the amount can be
 * updated, but the currency cannot — so an existing price is patched where it
 * can be and the caller is told plainly when it cannot.
 */
export async function syncPlanToPaddle(input: SyncInput): Promise<{ priceId: string; created: boolean }> {
    const amountMinor = String(Math.round(input.amount * 100));

    if (input.existingPriceId) {
        const current = await paddle(`/prices/${input.existingPriceId}`) as {
            unit_price?: { currency_code?: string };
        };
        const existingCurrency = current.unit_price?.currency_code;
        if (existingCurrency && existingCurrency !== input.currencyCode) {
            throw new Error(
                `That Paddle price is in ${existingCurrency} and this plan is in ${input.currencyCode}. `
                + 'Paddle cannot change a price’s currency — clear the price ID to create a new one.',
            );
        }
        await paddle(`/prices/${input.existingPriceId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                description: `${input.productLabel} ${input.planName}`,
                unit_price: { amount: amountMinor, currency_code: input.currencyCode },
            }),
        });
        return { priceId: input.existingPriceId, created: false };
    }

    // No price yet: find or create the product, then the price under it.
    const products = await paddle('/products?per_page=100&status=active') as Array<{ id: string; name: string }>;
    let product = products.find((p) => p.name === input.productLabel);
    if (!product) {
        product = await paddle('/products', {
            method: 'POST',
            body: JSON.stringify({
                name: input.productLabel,
                tax_category: 'standard',
                description: `${input.productLabel} subscription plans`,
            }),
        }) as { id: string; name: string };
    }

    const price = await paddle('/prices', {
        method: 'POST',
        body: JSON.stringify({
            product_id: product.id,
            description: `${input.productLabel} ${input.planName}`,
            unit_price: { amount: amountMinor, currency_code: input.currencyCode },
            billing_cycle: { interval: 'month', frequency: 1 },
            // A per-seat plan bills by quantity; a flat one is pinned to a
            // single unit so the quantity cannot be edited at checkout.
            quantity: input.perSeat ? { minimum: 1, maximum: 1000 } : { minimum: 1, maximum: 1 },
        }),
    }) as { id: string };

    return { priceId: price.id, created: true };
}
