import 'server-only';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { paddleRequest } from '@/lib/paddle-catalog';
import { asDate, asRecord, asString } from '@/lib/paddle-data';
import { moneyFromMinor, providerStatus } from '@/lib/billing-rules';
import { confirmSiteOrderPayment } from '@/lib/site-orders';
import { syncTransactionCredits } from '@/lib/credit-billing';
import type { PaddleWebhookEvent } from '@/lib/paddle';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function snapshot(tx: Tx, kind: string, data: Record<string, unknown>, userId: string | null) {
    const id = asString(data.id);
    const updated = asDate(data.updated_at) ?? asDate(data.created_at);
    if (!id || !updated) throw new Error('Provider record is missing its ID or timestamp.');
    await tx.insert(schema.billingProviderRecord).values({
        id, kind, userId, subscriptionId: asString(data.subscription_id), payload: data, providerUpdatedAt: updated,
    }).onConflictDoUpdate({ target: schema.billingProviderRecord.id,
        set: { kind, subscriptionId: asString(data.subscription_id), payload: data, userId, providerUpdatedAt: updated, syncedAt: new Date() },
        setWhere: sql`${schema.billingProviderRecord.providerUpdatedAt} <= ${updated.toISOString()}`,
    });
}

/** Always derive entitlement from a canonical subscription, never a transaction status or checkout metadata. */
export async function syncSubscription(tx: Tx, subscriptionId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${subscriptionId}`}, 0))`);
    const data = asRecord(await paddleRequest(`/subscriptions/${subscriptionId}`));
    const known = await tx.query.subscription.findFirst({ where: eq(schema.subscription.paddleSubscriptionId, subscriptionId) });
    const transactionId = asString(data.transaction_id);
    const origin = transactionId ? await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, transactionId) }) : null;
    // subscription.created contains the originating transaction even when GET omits it;
    // callers persist a server-owned linkage before reaching this function.
    const linkage = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, `owner:${subscriptionId}`) });
    const historical = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, subscriptionId) });
    const userId = known?.userId ?? historical?.userId ?? origin?.userId ?? linkage?.userId;
    if (!userId) throw new Error('Subscription ownership is unresolved; retry after checkout linkage arrives.');
    const priceIds = (Array.isArray(data.items) ? data.items : []).map((item) => asString(asRecord(asRecord(item).price).id)).filter((id): id is string => !!id);
    const plans = priceIds.length ? await tx.query.plan.findMany({ where: inArray(schema.plan.paddlePriceId, priceIds) }) : [];
    if (plans.length !== 1) throw new Error('Expected exactly one recognized base plan on the subscription.');
    const plan = plans[0];
    const updated = asDate(data.updated_at);
    if (!updated) throw new Error('Subscription timestamp is missing.');
    const source = asRecord(origin?.payload ?? historical?.payload);
    const linkedOrigin = asString(asRecord(linkage?.payload).transactionId);
    const linkedRecord = linkedOrigin ? await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, linkedOrigin) }) : null;
    const candidateOrderId = known?.siteOrderId ?? asString(asRecord(source.custom_data).siteOrderId) ?? asString(asRecord(asRecord(linkedRecord?.payload).custom_data).siteOrderId);
    const order = candidateOrderId ? await tx.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, candidateOrderId), eq(schema.siteOrder.userId, userId)) }) : null;
    if (candidateOrderId && !order) throw new Error('Site subscription ownership is unresolved.');
    const siteOrderId = order?.id ?? null;
    const existing = known ?? await tx.query.subscription.findFirst({ where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.productId, plan.productId), siteOrderId ? eq(schema.subscription.siteOrderId, siteOrderId) : isNull(schema.subscription.siteOrderId)) });
    await snapshot(tx, 'SUBSCRIPTION', data, userId);
    if (existing?.paddleSubscriptionId && existing.paddleSubscriptionId !== subscriptionId) {
        // A refund or late event for a prior subscription must not replace its successor.
        if (data.status === 'canceled') return { userId, plan };
        if (existing.status !== 'CANCELED') throw new Error('Another subscription already exists for this product. Manual billing review required.');
        // Preserve ownership for historical transactions after replacing the one-per-product entitlement row.
        await tx.insert(schema.billingProviderRecord).values({
            id: `owner:${existing.paddleSubscriptionId}`, kind: 'OWNERSHIP', userId,
            subscriptionId: existing.paddleSubscriptionId, payload: { legacySubscription: true }, providerUpdatedAt: new Date(),
        }).onConflictDoNothing();
    }
    const values = {
        planId: plan.id, status: providerStatus(data.status), paddleSubscriptionId: subscriptionId,
        paddleCustomerId: asString(data.customer_id), paddleUpdatedAt: updated, paddleSnapshot: data,
        currentPeriodEnd: asDate(asRecord(data.current_billing_period).ends_at),
        cancelAtPeriodEnd: asRecord(data.scheduled_change).action === 'cancel', canceledAt: asDate(data.canceled_at),
    };
    const graceEndsAt = values.status === 'PAST_DUE' ? existing?.graceEndsAt ?? new Date(Date.now() + 3 * 86400_000) : null;
    if (existing) {
        await tx.update(schema.subscription).set({ ...values, graceEndsAt }).where(and(eq(schema.subscription.id, existing.id), sql`(${schema.subscription.paddleUpdatedAt} is null or ${schema.subscription.paddleUpdatedAt} <= ${updated.toISOString()})`));
    } else {
        await tx.insert(schema.subscription).values({ userId, productId: plan.productId, siteOrderId, ...values, graceEndsAt });
    }
    if (values.status === 'ACTIVE' && !siteOrderId && !existing?.siteId) await tx.insert(schema.billingFulfillment).values({
        id: `${subscriptionId}:${updated.toISOString()}`, userId, planId: plan.id, subscriptionId,
    }).onConflictDoNothing();
    // Resolve uncertain upgrades only when the canonical items confirm the requested plan.
    await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', error: null, updatedAt: new Date() })
        .where(and(eq(schema.billingOperation.subscriptionId, subscriptionId), eq(schema.billingOperation.planId, plan.id), eq(schema.billingOperation.status, 'UNKNOWN'), sql`${schema.billingOperation.request}->'items' is not null`));
    const scheduledCredit = await tx.query.creditRedemption.findFirst({ where: and(eq(schema.creditRedemption.paddleSubscriptionId, subscriptionId), eq(schema.creditRedemption.kind, 'RENEWAL'), eq(schema.creditRedemption.status, 'RESERVED')) });
    if (scheduledCredit && asRecord(data.discount).id === scheduledCredit.paddleDiscountId) {
        await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', error: null, updatedAt: new Date() }).where(and(eq(schema.billingOperation.id, scheduledCredit.operationId), eq(schema.billingOperation.status, 'UNKNOWN')));
    }
    return { userId, plan };
}

async function linkOwner(tx: Tx, subscriptionId: string, transactionId: string | null) {
    if (!transactionId) return;
    // Renewals/upgrades inherit checkout metadata, including its original price.
    // Once linked, canonical subscription ownership takes precedence over that metadata.
    const known = await tx.query.subscription.findFirst({ where: eq(schema.subscription.paddleSubscriptionId, subscriptionId) });
    if (known) return;
    let transaction = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, transactionId) });
    if (!transaction?.userId) {
        const provider = asRecord(await paddleRequest(`/transactions/${transactionId}`));
        const operationId = asString(asRecord(provider.custom_data).billingOperationId);
        const operation = operationId ? await tx.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, operationId) }) : null;
        if (!operation || !operation.subscriptionId.startsWith('checkout:')) return;
        const customer = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, `customer:${operation.userId}`) });
        const items = Array.isArray(provider.items) ? provider.items : [];
        if (provider.customer_id !== asRecord(customer?.payload).customerId || items.length !== 1 || asRecord(asRecord(items[0]).price).id !== asRecord(operation.request).priceId) {
            throw new Error('Checkout ownership verification failed.');
        }
        await tx.insert(schema.billingProviderRecord).values({ id: transactionId, kind: 'CHECKOUT', userId: operation.userId, payload: provider, providerUpdatedAt: new Date() }).onConflictDoNothing();
        await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', error: null, updatedAt: new Date() }).where(eq(schema.billingOperation.id, operation.id));
        await tx.update(schema.billingProviderRecord).set({ payload: { transactionId, operationId: operation.id }, providerUpdatedAt: new Date() })
            .where(and(eq(schema.billingProviderRecord.id, operation.subscriptionId), sql`${schema.billingProviderRecord.payload}->>'operationId' = ${operation.id}`));
        transaction = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, transactionId) });
    }
    if (!transaction?.userId) return;
    await tx.insert(schema.billingProviderRecord).values({
        id: `owner:${subscriptionId}`, kind: 'OWNERSHIP', userId: transaction.userId,
        subscriptionId, payload: { transactionId }, providerUpdatedAt: new Date(),
    }).onConflictDoNothing();
}

async function syncTransaction(tx: Tx, transactionId: string) {
    let data = asRecord(await paddleRequest(`/transactions/${transactionId}`));
    const subscriptionId = asString(data.subscription_id);
    if (!subscriptionId) {
        const checkout = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, transactionId) });
        if (!checkout?.userId) throw new Error('Subscription transaction linkage is not available yet.');
        await snapshot(tx, 'TRANSACTION', data, checkout.userId);
        await syncTransactionCredits(tx, data, checkout.userId);
        return;
    }
    await linkOwner(tx, subscriptionId, transactionId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${subscriptionId}`}, 0))`);
    data = asRecord(await paddleRequest(`/transactions/${transactionId}`));
    const { userId, plan } = await syncSubscription(tx, subscriptionId);
    await snapshot(tx, 'TRANSACTION', data, userId);
    await syncTransactionCredits(tx, data, userId);
    await confirmSiteOrderPayment(tx, data, userId);
    const subscription = await tx.query.subscription.findFirst({ where: eq(schema.subscription.paddleSubscriptionId, subscriptionId) });
    const totals = asRecord(asRecord(data.details).totals);
    const currency = asString(data.currency_code);
    if (!currency) throw new Error('Transaction currency is missing.');
    const invoicePriceIds = (Array.isArray(data.items) ? data.items : []).map((item) => asString(asRecord(asRecord(item).price).id)).filter((id): id is string => !!id);
    const invoicePlans = invoicePriceIds.length ? await tx.query.plan.findMany({ where: inArray(schema.plan.paddlePriceId, invoicePriceIds) }) : [];
    const invoicePlan = invoicePlans.length === 1 ? invoicePlans[0] : plan;
    const amount = moneyFromMinor(totals.grand_total, currency);
    if (amount == null) throw new Error('Invalid transaction total.');
    const status = data.status === 'completed' ? 'PAID' : data.status === 'canceled' ? 'CANCELLED' : data.status === 'past_due' ? 'OVERDUE' : 'PENDING';
    const values = { amount, currency, status: status as 'PAID' | 'CANCELLED' | 'OVERDUE' | 'PENDING',
        paidAt: data.status === 'completed' ? asDate(data.updated_at) : null,
        periodStart: asDate(asRecord(data.billing_period).starts_at), periodEnd: asDate(asRecord(data.billing_period).ends_at) };
    await tx.insert(schema.billingRecord).values({
        userId, subscriptionId: subscription?.id, invoiceNumber: transactionId,
        description: `${invoicePlan.name} subscription billing`, paymentMethod: 'Paddle', paymentReference: transactionId,
        issuedAt: asDate(data.billed_at) ?? asDate(data.created_at) ?? new Date(), ...values,
    }).onConflictDoUpdate({ target: schema.billingRecord.invoiceNumber, set: { ...values, subscriptionId: subscription?.id ?? null } });
    await refreshRefunds(tx, transactionId);
    // Native balance is provider-owned and refreshed after any billing activity.
    const customerId = asString(data.customer_id);
    if (customerId) {
        const balances = await paddleRequest(`/customers/${customerId}/credit-balances`);
        await tx.insert(schema.billingProviderRecord).values({
            id: `credits:${customerId}`, kind: 'NATIVE_CREDITS', userId, payload: balances, providerUpdatedAt: new Date(),
        }).onConflictDoUpdate({ target: schema.billingProviderRecord.id, set: { payload: balances, syncedAt: new Date(), providerUpdatedAt: new Date() } });
    }
}

async function syncAdjustment(tx: Tx, id: string) {
    const data = asRecord(await paddleRequest(`/adjustments/${id}`));
    const transactionId = asString(data.transaction_id);
    if (!transactionId) throw new Error('Adjustment transaction is missing.');
    await syncTransaction(tx, transactionId);
    const record = await tx.query.billingRecord.findFirst({ where: eq(schema.billingRecord.invoiceNumber, transactionId) });
    if (!record) throw new Error('Adjustment billing record is unresolved.');
    await snapshot(tx, 'ADJUSTMENT', data, record.userId);
    await refreshRefunds(tx, transactionId);
}

async function refreshRefunds(tx: Tx, transactionId: string) {
    const record = await tx.query.billingRecord.findFirst({ where: eq(schema.billingRecord.invoiceNumber, transactionId) });
    if (!record) return;
    const adjustments = await tx.query.billingProviderRecord.findMany({ where: and(eq(schema.billingProviderRecord.kind, 'ADJUSTMENT'), eq(schema.billingProviderRecord.userId, record.userId)) });
    let refundedMinor = BigInt(0);
    let refundedAt: Date | null = null;
    for (const item of adjustments) {
        const adjustment = asRecord(item.payload);
        if (adjustment.transaction_id !== transactionId || adjustment.action !== 'refund' || adjustment.status !== 'approved') continue;
        const amount = asRecord(adjustment.totals).total;
        if (typeof amount !== 'string' || !/^\d+$/.test(amount)) throw new Error('Adjustment amount is invalid.');
        refundedMinor += BigInt(amount);
        const date = asDate(adjustment.updated_at) ?? asDate(adjustment.created_at);
        if (date && (!refundedAt || date > refundedAt)) refundedAt = date;
    }
    const refunded = moneyFromMinor(String(refundedMinor), record.currency);
    if (refunded == null) throw new Error('Refund amount is out of range.');
    if (adjustments.some((item) => asRecord(item.payload).transaction_id === transactionId)) {
        const provider = await tx.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, transactionId) });
        const providerData = asRecord(provider?.payload);
        const total = asRecord(asRecord(providerData.details).totals).grand_total;
        const fullyRefunded = refundedMinor > BigInt(0) && typeof total === 'string' && /^\d+$/.test(total) && refundedMinor >= BigInt(total);
        const base = providerData.status === 'completed' ? 'PAID' : providerData.status === 'canceled' ? 'CANCELLED' : providerData.status === 'past_due' ? 'OVERDUE' : 'PENDING';
        await tx.update(schema.billingRecord).set({
            refundedAmount: refunded, refundedAt, status: fullyRefunded ? 'REFUNDED' : base,
        }).where(eq(schema.billingRecord.id, record.id));
    }
}

export async function processPaddleEvent(id: string) {
    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`event:${id}`}, 0))`);
            const row = await tx.query.paddleEvent.findFirst({ where: eq(schema.paddleEvent.id, id) });
            if (!row || row.status === 'PROCESSED' || row.status === 'IGNORED') return;
            const event = row.payload as PaddleWebhookEvent;
            const providerId = asString(event.data.id);
            if (!providerId) throw new Error('Provider ID is missing.');
            if (event.event_type.startsWith('subscription.')) {
                await linkOwner(tx, providerId, asString(event.data.transaction_id));
                await syncSubscription(tx, providerId);
            } else if (event.event_type.startsWith('transaction.')) await syncTransaction(tx, providerId);
            else if (event.event_type.startsWith('adjustment.')) await syncAdjustment(tx, providerId);
            await tx.update(schema.paddleEvent).set({ status: 'PROCESSED', processedAt: new Date(), error: null, attempts: sql`${schema.paddleEvent.attempts} + 1` }).where(eq(schema.paddleEvent.id, id));
        });
        return true;
    } catch {
        // Avoid storing customer data or provider authentication details in error logs.
        await db.update(schema.paddleEvent).set({ status: 'FAILED', error: 'Synchronization failed; retry or inspect provider records.', attempts: sql`${schema.paddleEvent.attempts} + 1` })
            .where(and(eq(schema.paddleEvent.id, id), inArray(schema.paddleEvent.status, ['PENDING', 'FAILED'])));
        return false;
    }
}

export async function drainPaddleEvents(limit = 25) {
    const rows = await db.query.paddleEvent.findMany({
        where: and(inArray(schema.paddleEvent.status, ['PENDING', 'FAILED']), sql`${schema.paddleEvent.attempts} < 20`),
        orderBy: [asc(schema.paddleEvent.attempts), asc(schema.paddleEvent.receivedAt)], limit,
    });
    let processed = 0;
    for (const row of rows) if (await processPaddleEvent(row.id)) processed++;
    return { attempted: rows.length, processed };
}


export async function drainBillingFulfillments(limit = 25) {
    const rows = await db.query.billingFulfillment.findMany({
        where: and(isNull(schema.billingFulfillment.processedAt), sql`${schema.billingFulfillment.attempts} < 20`),
        orderBy: asc(schema.billingFulfillment.createdAt), limit,
    });
    for (const row of rows) {
        await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`fulfillment:${row.id}`}, 0))`);
            const current = await tx.query.billingFulfillment.findFirst({ where: eq(schema.billingFulfillment.id, row.id) });
            if (current?.processedAt) return;
            const subscription = await tx.query.subscription.findFirst({ where: eq(schema.subscription.paddleSubscriptionId, row.subscriptionId) });
            if (subscription?.status !== 'ACTIVE' || subscription.planId !== row.planId) {
                await tx.update(schema.billingFulfillment).set({ processedAt: new Date() }).where(eq(schema.billingFulfillment.id, row.id));
                return;
            }
            try {
                await controller.sites.convertTrials(row.userId, row.planId);
                await tx.update(schema.billingFulfillment).set({ processedAt: new Date() }).where(eq(schema.billingFulfillment.id, row.id));
            } catch {
                await tx.update(schema.billingFulfillment).set({ attempts: sql`${schema.billingFulfillment.attempts} + 1` }).where(eq(schema.billingFulfillment.id, row.id));
            }
        });
    }
    return { attempted: rows.length };
}

/** Repair known subscriptions plus their transactions and adjustments, without relying on webhook arrival. */
export async function reconcilePaddleSubscription(subscriptionId: string) {
    await db.transaction(async (tx) => { await syncSubscription(tx, subscriptionId); });
    for (const kind of ['transactions', 'adjustments'] as const) {
        let after = '';
        for (let page = 0; page < 100; page++) {
            const params = new URLSearchParams({ subscription_id: subscriptionId, per_page: '50', ...(after ? { after } : {}) });
            const records = await paddleRequest(`/${kind}?${params}`);
            if (!Array.isArray(records)) throw new Error('Invalid reconciliation response.');
            for (const record of records) {
                const data = asRecord(record);
                const id = asString(data.id);
                if (!id) throw new Error('Invalid reconciliation record.');
                await db.transaction(async (tx) => {
                    if (kind === 'transactions') await syncTransaction(tx, id);
                    else await syncAdjustment(tx, id);
                });
            }
            if (records.length < 50) break;
            after = String(records[records.length - 1].id);
            if (page === 99) throw new Error('Reconciliation exceeded page limit; manual review required.');
        }
    }
}

/** A crashed worker must leave an explicit uncertain operation, never an invisible retryable charge. */
export async function recoverStalledBillingOperations() {
    await db.update(schema.billingOperation).set({ status: 'UNKNOWN', error: 'Worker stopped before confirming provider outcome.', updatedAt: new Date() })
        .where(and(eq(schema.billingOperation.status, 'PROCESSING'), sql`${schema.billingOperation.updatedAt} < timezone('UTC', now()) - interval '5 minutes'`));
    const pending = await db.query.billingOperation.findMany({
        where: and(eq(schema.billingOperation.status, 'UNKNOWN'), sql`${schema.billingOperation.subscriptionId} like 'sub_%'`),
        orderBy: asc(schema.billingOperation.updatedAt), limit: 2,
    });
    for (const operation of pending) {
        try { await db.transaction(async (tx) => { await syncSubscription(tx, operation.subscriptionId); }); }
        catch { /* Leave uncertain until another webhook/reconciliation or operator review resolves it. */ }
    }
}

export async function reconcilePaddleTransaction(transactionId: string) {
    await db.transaction(async (tx) => { await syncTransaction(tx, transactionId); });
}

export async function reconcileAllPaddleBilling() {
    const subscriptions = await db.query.subscription.findMany({ where: sql`${schema.subscription.paddleSubscriptionId} is not null` });
    for (const subscription of subscriptions) await reconcilePaddleSubscription(subscription.paddleSubscriptionId!);
    // Discover payments whose initial webhook was missed, using server-owned customer mappings.
    const customers = await db.query.billingProviderRecord.findMany({ where: eq(schema.billingProviderRecord.kind, 'CUSTOMER') });
    for (const customer of customers) {
        const customerId = asString(asRecord(customer.payload).customerId);
        if (!customerId) continue;
        let after = '';
        for (let page = 0; page < 100; page++) {
            const params = new URLSearchParams({ customer_id: customerId, per_page: '50', ...(after ? { after } : {}) });
            const records = await paddleRequest(`/transactions?${params}`);
            if (!Array.isArray(records)) throw new Error('Invalid customer reconciliation response.');
            for (const record of records) {
                const data = asRecord(record);
                const id = asString(data.id);
                if (id && asString(data.subscription_id)) await reconcilePaddleTransaction(id);
            }
            if (records.length < 50) break;
            after = String(records[records.length - 1].id);
            if (page === 99) throw new Error('Customer reconciliation exceeded page limit.');
        }
    }
}
