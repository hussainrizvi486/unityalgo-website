import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { CheckoutError, reportBillingFailure } from '@/lib/billing-errors';
import { db, schema } from '@/lib/db';
import { paddleRequest, PaddleApiError } from '@/lib/paddle-catalog';
import { prepareCreditDiscount, releaseCreditOperation, creditAmount } from '@/lib/credit-billing';
import { asRecord, asString } from '@/lib/paddle-data';

/**
 * Paddle allows one customer per email. When the account already knows this email (a customer created before this
 * database mapped it, or by an earlier test run against the same sandbox) creation answers 409, so reuse that customer
 * once it is proven to belong to the same email address.
 */
export async function ensurePaddleCustomer(userId: string, email: string): Promise<string | null> {
    try {
        const customer = asRecord(await paddleRequest('/customers', { method: 'POST', body: JSON.stringify({ email, custom_data: { userId } }) }));
        return asString(customer.id);
    } catch (error) {
        if (!(error instanceof PaddleApiError) || error.status !== 409) throw error;
        const hinted = /\bctm_[0-9a-z]+\b/.exec(error.message)?.[0];
        const listed = hinted ? [] : await paddleRequest(`/customers?email=${encodeURIComponent(email)}`);
        const candidates = hinted ? [hinted] : (Array.isArray(listed) ? listed : []).map((row) => asString(asRecord(row).id)).filter((id): id is string => Boolean(id));
        for (const candidate of candidates) {
            const existing = asRecord(await paddleRequest(`/customers/${candidate}`));
            if (asString(existing.email)?.toLowerCase() !== email.toLowerCase()) continue;
            if (existing.status === 'archived') await paddleRequest(`/customers/${candidate}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
            return candidate;
        }
        throw error;
    }
}

/** Commit an operation before calling Paddle so a timeout never silently opens a second checkout. */
export async function createPlanCheckout(userId: string, planId: string, useCredits = true, siteOrderId?: string) {
    const plan = await db.query.plan.findFirst({ where: and(eq(schema.plan.id, planId), eq(schema.plan.isActive, true)) });
    if (!plan?.paddlePriceId || plan.priceAmount == null) throw new CheckoutError('Plan is unavailable.');
    const key = `checkout:${userId}:${siteOrderId ?? plan.productId}`;
    const claim = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        const current = await tx.query.subscription.findFirst({ where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.productId, plan.productId), siteOrderId ? eq(schema.subscription.siteOrderId, siteOrderId) : isNull(schema.subscription.siteOrderId)) });
        if (current?.paddleSubscriptionId && current.status !== 'CANCELED') throw new CheckoutError('You already have a subscription. Refresh to change plans.');
        const pending = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, key) });
        if (pending) {
            const payload = asRecord(pending.payload);
            const pendingId = asString(payload.transactionId);
            if (!pendingId) throw new CheckoutError('Your previous checkout is being checked. Contact support before retrying.');
            const previous = asRecord(await paddleRequest(`/transactions/${pendingId}`));
            const priorSubscription = asString(previous.subscription_id);
            const previousWasCanceledSubscription = current?.status === 'CANCELED' && current.paddleSubscriptionId === priorSubscription;
            if (previous.status !== 'canceled' && !previousWasCanceledSubscription) {
                if (previous.status !== 'draft' && previous.status !== 'ready') throw new CheckoutError('Your previous payment is being synchronized. Refresh shortly.');
                if ((asString(asRecord(previous.custom_data).siteOrderId) ?? undefined) !== siteOrderId) throw new CheckoutError('Finish your existing checkout before starting another site setup.');
                if (asRecord(previous.custom_data).planId !== planId) throw new CheckoutError('Finish or cancel your existing checkout before selecting another plan.');
                return { transactionId: pendingId };
            }
            const previousOperation = asString(payload.operationId);
            if (previousOperation && previous.status === 'canceled') await releaseCreditOperation(previousOperation);
        }
        const [operation] = await tx.insert(schema.billingOperation).values({
            userId, subscriptionId: key, planId, status: 'PROCESSING', request: { priceId: plan.paddlePriceId, ...(siteOrderId ? { siteOrderId } : {}) },
            preview: {}, expectedUpdatedAt: '', expiresAt: new Date(Date.now() + 120_000),
        }).returning();
        await tx.insert(schema.billingProviderRecord).values({ id: key, kind: 'CHECKOUT_INTENT', userId, payload: { operationId: operation.id }, providerUpdatedAt: new Date() })
            .onConflictDoUpdate({ target: schema.billingProviderRecord.id, set: { payload: { operationId: operation.id }, providerUpdatedAt: new Date() } });
        return { operationId: operation.id };
    });
    if (claim.transactionId) return claim.transactionId;
    let customerId: string | null = null;
    let transactionSent = false;
    let stage = 'customer';
    try {
        // Customer creation cannot charge money. Serialize it across products and reuse the mapping.
        customerId = await db.transaction(async (tx) => {
            const customerKey = `customer:${userId}`;
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${customerKey}, 0))`);
            const mapped = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, customerKey) });
            const stored = asString(asRecord(mapped?.payload).customerId);
            if (stored) return stored;
            const legacy = await tx.query.subscription.findFirst({ where: and(eq(schema.subscription.userId, userId), sql`${schema.subscription.paddleCustomerId} is not null`) });
            let id = legacy?.paddleCustomerId;
            if (!id) {
                const user = await tx.query.user.findFirst({ where: eq(schema.user.id, userId) });
                if (!user) throw new Error('Customer not found.');
                id = await ensurePaddleCustomer(userId, user.email);
            }
            if (!id) throw new Error('Could not establish billing customer.');
            await tx.insert(schema.billingProviderRecord).values({ id: customerKey, kind: 'CUSTOMER', userId, payload: { customerId: id }, providerUpdatedAt: new Date() });
            return id;
        });
        stage = 'price';
        const price = asRecord(await paddleRequest(`/prices/${plan.paddlePriceId}`));
        const currency = asString(asRecord(price.unit_price).currency_code);
        if (!currency) throw new Error('Paddle price currency is missing.');
        stage = 'credits';
        const redemption = useCredits && !price.trial_period ? await prepareCreditDiscount({
            userId, operationId: claim.operationId!, currency,
            maximum: creditAmount(asRecord(price.unit_price).amount), priceId: plan.paddlePriceId, kind: 'CHECKOUT',
        }) : null;
        stage = 'transaction';
        transactionSent = true;
        const transaction = asRecord(await paddleRequest('/transactions', { method: 'POST', body: JSON.stringify({
            items: [{ price_id: plan.paddlePriceId, quantity: 1 }], customer_id: customerId,
            collection_mode: 'automatic', currency_code: currency, ...(redemption ? { discount_id: redemption.paddleDiscountId } : {}), custom_data: { userId, planId, billingOperationId: claim.operationId, ...(siteOrderId ? { siteOrderId } : {}) },
        }) }));
        stage = 'persist_transaction';
        const id = asString(transaction.id);
        if (!id) throw new Error('Paddle did not return a transaction.');
        await db.transaction(async (tx) => {
            if (redemption) await tx.update(schema.creditRedemption).set({ paddleTransactionId: id, updatedAt: new Date() }).where(eq(schema.creditRedemption.id, redemption.id));
            await tx.insert(schema.billingProviderRecord).values({ id, kind: 'CHECKOUT', userId, payload: transaction, providerUpdatedAt: new Date() });
            await tx.update(schema.billingProviderRecord).set({ payload: { transactionId: id, operationId: claim.operationId }, providerUpdatedAt: new Date() }).where(eq(schema.billingProviderRecord.id, key));
            await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', updatedAt: new Date() }).where(eq(schema.billingOperation.id, claim.operationId!));
        });
        return id;
    } catch (error) {
        const failure = reportBillingFailure(error, { action: 'create_checkout', operationId: claim.operationId, stage });
        // Even a customer-creation failure stays visible. A support reconciliation explicitly clears it.
        const rejected = !transactionSent || (error instanceof PaddleApiError && [400, 401, 403, 404, 422].includes(error.status));
        await db.update(schema.billingOperation).set({ status: rejected ? 'FAILED' : 'UNKNOWN', error: 'Checkout needs provider reconciliation.', updatedAt: new Date() }).where(eq(schema.billingOperation.id, claim.operationId!));
        if (rejected) {
            try { await releaseCreditOperation(claim.operationId!); } catch { /* Maintenance will retry safe release. */ }
            await db.delete(schema.billingProviderRecord).where(and(eq(schema.billingProviderRecord.id, key), sql`${schema.billingProviderRecord.payload}->>'operationId' = ${claim.operationId!}`));
        }
        throw new CheckoutError(rejected ? failure.message : `The payment result needs to be checked. Please contact support before submitting another payment. Reference: ${failure.reference}`, failure.reference);
    }
}


export async function cancelPendingCheckout(userId: string, planId: string, siteOrderId?: string) {
    const plan = await db.query.plan.findFirst({ where: eq(schema.plan.id, planId) });
    if (!plan) throw new Error('Plan not found.');
    const key = `checkout:${userId}:${siteOrderId ?? plan.productId}`;
    const operationId = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        const pending = await tx.query.billingProviderRecord.findFirst({ where: and(eq(schema.billingProviderRecord.id, key), eq(schema.billingProviderRecord.userId, userId)) });
        const id = asString(asRecord(pending?.payload).transactionId);
        if (!id) throw new Error('This checkout needs billing review before it can be canceled.');
        const current = asRecord(await paddleRequest(`/transactions/${id}`));
        if (current.status === 'canceled') return asString(asRecord(pending?.payload).operationId);
        if (current.status !== 'draft' && current.status !== 'ready') throw new Error('This checkout has already progressed. Check your billing history.');
        await paddleRequest(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled' }) });
        return asString(asRecord(pending?.payload).operationId);
    });
    if (operationId) await releaseCreditOperation(operationId);
}
