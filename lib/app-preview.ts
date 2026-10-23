import 'server-only';
import { and, count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { appBillingMode, billingSubscription, BillingError, isPaidApp } from '@/lib/app-billing';
import { moneyFromMinor } from '@/lib/billing-rules';
import { paddleRequest } from '@/lib/paddle-catalog';
import { asRecord, asString } from '@/lib/paddle-data';

type App = typeof schema.appCatalog.$inferSelect;
type Items = Array<{ price: { id: string }; quantity: number }>;

export interface AppChargePreview {
    /** Charged right away: the rest of this billing period, prorated by Paddle. */
    chargeNow: number;
    currency: string;
    /** The whole subscription from the next renewal on. */
    nextTotal: number | null;
    nextBilledAt: string | null;
}

/** The subscription's items with one price set to `quantity`. Every other item is kept exactly as it is. */
export function itemsWithQuantity(items: Items, priceId: string, quantity: number) {
    const kept = items.filter((item) => item.price.id !== priceId).map((item) => ({ price_id: item.price.id, quantity: item.quantity }));
    return quantity > 0 ? [...kept, { price_id: priceId, quantity }] : kept;
}

/** Reads Paddle's subscription-update preview. A preview without a currency or amount is refused, never guessed. */
export function parseAppPreview(preview: unknown): AppChargePreview {
    const data = asRecord(preview);
    const totals = asRecord(asRecord(asRecord(data.immediate_transaction).details).totals);
    const result = asRecord(asRecord(data.update_summary).result);
    const currency = asString(totals.currency_code) ?? asString(result.currency_code) ?? asString(data.currency_code);
    const raw = asString(totals.balance) ?? asString(totals.grand_total) ?? asString(result.amount);
    const chargeNow = currency ? moneyFromMinor(raw, currency) : null;
    if (!currency || chargeNow == null) throw new BillingError('Paddle did not return a complete price. Please try again.');
    const next = asRecord(asRecord(asRecord(data.next_transaction).details).totals);
    return { chargeNow, currency, nextTotal: moneyFromMinor(asString(next.grand_total) ?? asString(next.total), currency), nextBilledAt: asString(data.next_billed_at) };
}

/** What adding one more of this app to the site costs today and from the next renewal. Nothing is charged. */
export async function previewAppPurchase(input: { userId: string; app: App; siteId: string; planId?: string | null }): Promise<AppChargePreview> {
    const { userId, app, siteId } = input;
    if (!isPaidApp(app)) throw new BillingError('This application is free.');
    if (appBillingMode() !== 'paddle') throw new BillingError('Billing is not available right now.');
    if (!app.paddlePriceId) throw new BillingError('This application has not been set up for billing yet. Please contact support.');
    const subscription = await billingSubscription(userId, input.planId, db, siteId);
    if (!subscription?.paddleSubscriptionId) throw new BillingError('Subscribe to a plan before adding paid apps, so there is a subscription to bill them to.');
    let current: { status: string; scheduled_change?: unknown; items: Items };
    try {
        current = (await paddleRequest(`/subscriptions/${subscription.paddleSubscriptionId}`)) as typeof current;
    } catch (error) {
        throw new BillingError(`Your subscription could not be read: ${(error as Error).message}`);
    }
    if (current.status !== 'active') throw new BillingError('Your subscription is not active, so apps cannot be added to it.');
    if (current.scheduled_change) throw new BillingError('Your subscription is set to end. Keep it on the Subscription page before adding apps.');
    const [{ n }] = await db.select({ n: count() }).from(schema.appPurchase).where(and(
        eq(schema.appPurchase.userId, userId), eq(schema.appPurchase.appId, app.id), eq(schema.appPurchase.status, 'ACTIVE'),
        eq(schema.appPurchase.billingMode, 'paddle'), eq(schema.appPurchase.paddleSubscriptionId, subscription.paddleSubscriptionId),
    ));
    try {
        return parseAppPreview(await paddleRequest(`/subscriptions/${subscription.paddleSubscriptionId}/preview`, {
            method: 'PATCH',
            body: JSON.stringify({ items: itemsWithQuantity(current.items, app.paddlePriceId, n + 1), proration_billing_mode: 'prorated_immediately', on_payment_failure: 'prevent_change' }),
        }));
    } catch (error) {
        if (error instanceof BillingError) throw error;
        throw new BillingError(`The price could not be calculated: ${(error as Error).message}`);
    }
}
