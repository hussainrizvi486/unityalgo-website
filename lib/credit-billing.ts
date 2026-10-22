import 'server-only';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paddleRequest } from '@/lib/paddle-catalog';
import { asRecord, asString } from '@/lib/paddle-data';
import { reserveCustomerCredits, releaseCustomerCredits, settleCustomerCredits, type CreditTx } from '@/lib/customer-credits';

export function creditAmount(value: unknown) {
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid provider credit amount.');
    return Number(value);
}

/** Grants are non-cash invoice discounts, not deposits into Paddle's transaction-credit balance. */
export async function prepareCreditDiscount(input: {
    userId: string; operationId: string; currency: string; maximum: number; priceId: string;
    kind: 'CHECKOUT' | 'UPGRADE' | 'RENEWAL'; subscriptionId?: string;
}) {
    const redemption = await reserveCustomerCredits(input);
    if (!redemption) return null;
    if (redemption.paddleDiscountId) return redemption;
    const discount = asRecord(await paddleRequest('/discounts', { method: 'POST', body: JSON.stringify({
        description: `Account credits ${redemption.id}`, type: 'flat', amount: String(redemption.reservedAmount),
        currency_code: input.currency, enabled_for_checkout: false, usage_limit: 1, restrict_to: [input.priceId],
        recur: input.kind !== 'CHECKOUT', ...(input.kind === 'CHECKOUT' ? {} : { maximum_recurring_intervals: 1 }),
        custom_data: { creditRedemptionId: redemption.id },
    }) }));
    const id = asString(discount.id);
    if (!id) throw new Error('Paddle did not return a credit discount.');
    const [updated] = await db.update(schema.creditRedemption).set({ paddleDiscountId: id, updatedAt: new Date() }).where(eq(schema.creditRedemption.id, redemption.id)).returning();
    return updated;
}

/** Never permit a second billable mutation while a reusable subscription discount is outstanding. */
export async function assertNoPendingSubscriptionCredits(tx: Pick<CreditTx, 'query'>, subscriptionId: string, exceptOperationId?: string) {
    const pending = await tx.query.creditRedemption.findFirst({ where: and(
        eq(schema.creditRedemption.paddleSubscriptionId, subscriptionId), eq(schema.creditRedemption.cleanupRequired, true),
        ...(exceptOperationId ? [ne(schema.creditRedemption.operationId, exceptOperationId)] : []),
    ) });
    if (pending) throw new Error('Credits are allocated to this subscription. Finish billing synchronization or release scheduled renewal credits before changing it.');
}

/** Remove a temporary recurring discount before it can affect an unrelated bill. */
export async function detachCreditDiscount(redemptionId: string) {
    const redemption = await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, redemptionId) });
    if (!redemption?.cleanupRequired || !redemption.paddleSubscriptionId) return;
    await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${redemption.paddleSubscriptionId}`}, 0))`);
        const current = asRecord(await paddleRequest(`/subscriptions/${redemption.paddleSubscriptionId}`));
        if (asRecord(current.discount).id === redemption.paddleDiscountId && current.status !== 'canceled') {
            await paddleRequest(`/subscriptions/${redemption.paddleSubscriptionId}`, { method: 'PATCH', body: JSON.stringify({ discount: null, proration_billing_mode: 'do_not_bill' }) });
        }
        await tx.update(schema.creditRedemption).set({ cleanupRequired: false, updatedAt: new Date() }).where(eq(schema.creditRedemption.id, redemptionId));
    });
}

export async function releaseCreditOperation(operationId: string) {
    const redemption = await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.operationId, operationId) });
    if (!redemption || redemption.status !== 'RESERVED') return;
    // A completed checkout must settle, even if its subscription was subsequently canceled.
    if (redemption.kind === 'CHECKOUT' && redemption.paddleTransactionId) {
        const transaction = asRecord(await paddleRequest(`/transactions/${redemption.paddleTransactionId}`));
        if (transaction.status !== 'canceled') throw new Error('Checkout credits remain reserved until payment is finalized or canceled.');
    }
    await detachCreditDiscount(redemption.id);
    if (redemption.paddleDiscountId) await paddleRequest(`/discounts/${redemption.paddleDiscountId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
    await db.transaction(async (tx) => { await releaseCustomerCredits(tx, redemption.id); });
}

export async function syncTransactionCredits(tx: CreditTx, data: Record<string, unknown>, userId: string) {
    const id = asString(data.id);
    if (!id) throw new Error('Transaction ID is missing.');
    const discountId = asString(data.discount_id);
    const redemption = await tx.query.creditRedemption.findFirst({ where: discountId
        ? eq(schema.creditRedemption.paddleDiscountId, discountId)
        : eq(schema.creditRedemption.paddleTransactionId, id),
    });
    if (!redemption) return;
    if (redemption.userId !== userId || data.currency_code !== redemption.currency) throw new Error('Credit ownership/currency mismatch.');
    const paidDiscount = creditAmount(asRecord(asRecord(data.details).totals).discount ?? '0');
    if (data.status === 'completed') {
        if (!discountId || discountId !== redemption.paddleDiscountId) {
            if (paidDiscount !== 0) throw new Error('Cannot attribute another discount to account credits.');
        }
        await settleCustomerCredits(tx, { redemptionId: redemption.id, transactionId: id, currency: redemption.currency, discountAmount: discountId === redemption.paddleDiscountId ? paidDiscount : 0 });
    } else {
        if (redemption.paddleTransactionId && redemption.paddleTransactionId !== id) throw new Error('Credit discount was attached to another invoice.');
        await tx.update(schema.creditRedemption).set({ paddleTransactionId: id, updatedAt: new Date() }).where(eq(schema.creditRedemption.id, redemption.id));
        // Canceled transactions are handled by maintenance, which first archives/removes their discounts.
    }
}

export async function maintainCreditRedemptions(limit = 10) {
    const rows = await db.query.creditRedemption.findMany({ where: or(eq(schema.creditRedemption.status, 'RESERVED'), and(eq(schema.creditRedemption.status, 'SETTLED'), eq(schema.creditRedemption.cleanupRequired, true))), orderBy: asc(schema.creditRedemption.updatedAt), limit });
    for (const redemption of rows) {
        try {
            const operation = await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, redemption.operationId) });
            if (redemption.status === 'SETTLED' || (redemption.kind === 'UPGRADE' && operation?.status === 'SUCCEEDED')) {
                await detachCreditDiscount(redemption.id);
                if (redemption.status === 'SETTLED') continue;
            }
            if (operation?.status === 'QUOTED' && operation.expiresAt.getTime() < Date.now()) {
                // Claim the quote so confirmation cannot race its release.
                const [claimed] = await db.update(schema.billingOperation).set({ status: 'FAILED', error: 'Credit preview expired.', updatedAt: new Date() }).where(and(eq(schema.billingOperation.id, operation.id), eq(schema.billingOperation.status, 'QUOTED'))).returning();
                if (claimed) await releaseCreditOperation(operation.id);
            } else if (operation?.status === 'FAILED') await releaseCreditOperation(operation.id);
            else if (redemption.paddleTransactionId) {
                const transaction = asRecord(await paddleRequest(`/transactions/${redemption.paddleTransactionId}`));
                if (transaction.status === 'canceled') await releaseCreditOperation(redemption.operationId);
            }
        } catch { /* Durable reservation remains held until provider state can be verified. */ }
        await db.update(schema.creditRedemption).set({ updatedAt: new Date() }).where(eq(schema.creditRedemption.id, redemption.id));
    }
}

/** Reserve a customer's grant for exactly the next renewal, before Paddle starts collection. */
export async function prepareRenewalCredits(userId: string, subscriptionId: string) {
    const local = await db.query.subscription.findFirst({ where: and(eq(schema.subscription.id, subscriptionId), eq(schema.subscription.userId, userId)), with: { plan: true } });
    if (!local?.paddleSubscriptionId || !local.plan.paddlePriceId) throw new Error('Paid subscription not found.');
    const providerId = local.paddleSubscriptionId;
    const operation = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${providerId}`}, 0))`);
        await assertNoPendingSubscriptionCredits(tx, providerId);
        const current = asRecord(await paddleRequest(`/subscriptions/${providerId}?include=next_transaction`));
        if (current.status !== 'active' || current.scheduled_change || current.discount) throw new Error('Renewal credits require an active subscription without another discount or scheduled change.');
        if (current.customer_id !== local.paddleCustomerId) throw new Error('Billing ownership mismatch.');
        const nextDate = asString(current.next_billed_at);
        if (!nextDate || new Date(nextDate).getTime() < Date.now() + 3_600_000) throw new Error('The renewal is too close to collection. Apply credits to a later invoice.');
        const next = asRecord(current.next_transaction);
        const totals = asRecord(asRecord(next.details).totals);
        const currency = asString(current.currency_code) ?? asString(totals.currency_code);
        const subtotal = creditAmount(totals.subtotal);
        if (!currency || subtotal <= 0) throw new Error('No eligible renewal charge was found.');
        const [created] = await tx.insert(schema.billingOperation).values({
            userId, planId: local.planId, subscriptionId: providerId, status: 'PROCESSING', request: {},
            preview: { nextBilledAt: nextDate, currency, subtotal }, expectedUpdatedAt: String(current.updated_at), expiresAt: new Date(nextDate),
        }).returning();
        return created;
    });
    let sent = false;
    try {
        const quote = asRecord(operation.preview);
        const redemption = await prepareCreditDiscount({ userId, operationId: operation.id, currency: String(quote.currency), maximum: Number(quote.subtotal), priceId: local.plan.paddlePriceId, kind: 'RENEWAL', subscriptionId: providerId });
        if (!redemption) throw new Error('There are no available credits in this billing currency.');
        const request = { discount: { id: redemption.paddleDiscountId, effective_from: 'next_billing_period' }, proration_billing_mode: 'do_not_bill' };
        const preview = asRecord(await paddleRequest(`/subscriptions/${providerId}/preview`, { method: 'PATCH', body: JSON.stringify(request) }));
        const totals = asRecord(asRecord(asRecord(preview.next_transaction).details).totals);
        const applied = creditAmount(totals.discount ?? '0');
        if (applied <= 0 || applied > redemption.reservedAmount) throw new Error('Paddle could not apply a safe credit amount to the next invoice.');
        await db.update(schema.creditRedemption).set({ cleanupRequired: true }).where(eq(schema.creditRedemption.id, redemption.id));
        await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${providerId}`}, 0))`);
            const current = asRecord(await paddleRequest(`/subscriptions/${providerId}`));
            if (current.updated_at !== operation.expectedUpdatedAt || current.discount || current.next_billed_at !== quote.nextBilledAt) throw new Error('The subscription changed. Try again after synchronization.');
            sent = true;
            await paddleRequest(`/subscriptions/${providerId}`, { method: 'PATCH', body: JSON.stringify(request) });
            await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', request, updatedAt: new Date() }).where(eq(schema.billingOperation.id, operation.id));
        });
        return { applied, currency: redemption.currency };
    } catch (error) {
        // An ambiguous renewal mutation must retain its reservation until reconciled.
        await db.update(schema.billingOperation).set({ status: sent ? 'UNKNOWN' : 'FAILED', error: 'Renewal credit scheduling needs verification.', updatedAt: new Date() }).where(eq(schema.billingOperation.id, operation.id));
        if (!sent) { try { await releaseCreditOperation(operation.id); } catch { /* Maintenance retries. */ } }
        throw error;
    }
}

/** Release only a future allocation whose billing date has not advanced and whose invoice does not exist locally. */
export async function cancelRenewalCredits(userId: string, redemptionId: string) {
    await db.transaction(async (tx) => {
        const redemption = await tx.query.creditRedemption.findFirst({ where: and(eq(schema.creditRedemption.id, redemptionId), eq(schema.creditRedemption.userId, userId)) });
        if (!redemption || redemption.kind !== 'RENEWAL' || redemption.status !== 'RESERVED' || !redemption.paddleSubscriptionId) throw new Error('Scheduled credits not found.');
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${redemption.paddleSubscriptionId}`}, 0))`);
        const operation = await tx.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, redemption.operationId) });
        if (operation?.status !== 'SUCCEEDED') throw new Error('The billing result must be confirmed before these credits can be released.');
        const current = asRecord(await paddleRequest(`/subscriptions/${redemption.paddleSubscriptionId}`));
        const expectedDate = asString(asRecord(operation.preview).nextBilledAt);
        if (redemption.paddleTransactionId || !expectedDate || current.next_billed_at !== expectedDate || new Date(expectedDate).getTime() < Date.now() + 3_600_000) throw new Error('The renewal may already be processing. Credits remain reserved until its outcome is known.');
        if (asRecord(current.discount).id === redemption.paddleDiscountId) await paddleRequest(`/subscriptions/${redemption.paddleSubscriptionId}`, { method: 'PATCH', body: JSON.stringify({ discount: null, proration_billing_mode: 'do_not_bill' }) });
        if (redemption.paddleDiscountId) await paddleRequest(`/discounts/${redemption.paddleDiscountId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
        await tx.update(schema.creditRedemption).set({ cleanupRequired: false }).where(eq(schema.creditRedemption.id, redemption.id));
        await releaseCustomerCredits(tx, redemption.id);
        await tx.update(schema.billingOperation).set({ status: 'FAILED', error: 'Customer released scheduled credits.', updatedAt: new Date() }).where(eq(schema.billingOperation.id, operation.id));
    });
}
