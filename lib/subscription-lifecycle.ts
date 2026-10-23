import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paddleRequest, PaddleApiError } from '@/lib/paddle-catalog';
import { reconcilePaddleSubscription } from '@/lib/paddle-sync';
import { asRecord, asString } from '@/lib/paddle-data';

export class SubscriptionActionError extends Error {}

async function ownedPaidSubscription(userId: string, subscriptionId: string) {
    const subscription = await db.query.subscription.findFirst({ where: and(eq(schema.subscription.id, subscriptionId), eq(schema.subscription.userId, userId)) });
    if (!subscription?.paddleSubscriptionId) throw new SubscriptionActionError('This subscription is not billed online, so it cannot be changed here.');
    return { subscription, providerId: subscription.paddleSubscriptionId };
}

/** Bring the local record in line with Paddle; the webhook would do it too, but the page should be right immediately. */
async function refresh(providerId: string) {
    try { await reconcilePaddleSubscription(providerId); } catch { /* The webhook and billing worker repeat this. */ }
}

function friendly(error: unknown, fallback: string): never {
    if (error instanceof PaddleApiError && [400, 404, 409, 422].includes(error.status)) throw new SubscriptionActionError(fallback);
    throw error;
}

/**
 * Stop renewal at the end of the paid period; the customer keeps what they paid for until then. A subscription that is
 * past due has no paid period left, so Paddle ends it right away instead. Returns which one happened.
 */
export async function cancelAtPeriodEnd(userId: string, subscriptionId: string) {
    const { subscription, providerId } = await ownedPaidSubscription(userId, subscriptionId);
    if (!['ACTIVE', 'PAST_DUE'].includes(subscription.status)) throw new SubscriptionActionError('Only an active subscription can be canceled.');
    let immediate = false;
    await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${providerId}`}, 0))`);
        const current = asRecord(await paddleRequest(`/subscriptions/${providerId}`));
        if (asString(current.customer_id) !== subscription.paddleCustomerId) throw new SubscriptionActionError('Billing ownership could not be verified.');
        if (current.status === 'canceled' || asString(asRecord(current.scheduled_change).action) === 'cancel') return;
        immediate = current.status === 'past_due';
        try { await paddleRequest(`/subscriptions/${providerId}/cancel`, { method: 'POST', body: JSON.stringify({ effective_from: immediate ? 'immediately' : 'next_billing_period' }) }); }
        catch (error) { friendly(error, 'Paddle could not cancel the subscription. Refresh and try again.'); }
    });
    if (!immediate) await db.update(schema.subscription).set({ cancelAtPeriodEnd: true }).where(eq(schema.subscription.id, subscription.id));
    await refresh(providerId);
    return { immediate };
}

/** Undo a scheduled cancellation before the period ends. */
export async function resumeScheduledCancellation(userId: string, subscriptionId: string) {
    const { subscription, providerId } = await ownedPaidSubscription(userId, subscriptionId);
    if (!subscription.cancelAtPeriodEnd) throw new SubscriptionActionError('This subscription is not set to cancel.');
    await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${providerId}`}, 0))`);
        const current = asRecord(await paddleRequest(`/subscriptions/${providerId}`));
        if (asString(current.customer_id) !== subscription.paddleCustomerId) throw new SubscriptionActionError('Billing ownership could not be verified.');
        if (current.status === 'canceled') throw new SubscriptionActionError('This subscription has already ended. Choose a plan to start a new one.');
        if (asString(asRecord(current.scheduled_change).action) !== 'cancel') return;
        try { await paddleRequest(`/subscriptions/${providerId}`, { method: 'PATCH', body: JSON.stringify({ scheduled_change: null }) }); }
        catch (error) { friendly(error, 'Paddle could not remove the cancellation. Refresh and try again.'); }
    });
    await db.update(schema.subscription).set({ cancelAtPeriodEnd: false, canceledAt: null }).where(eq(schema.subscription.id, subscription.id));
    await refresh(providerId);
}
