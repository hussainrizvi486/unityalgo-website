import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { controller } from '@/lib/controller-client';
import { db, schema } from '@/lib/db';
import { paddleRequest, PaddleApiError } from '@/lib/paddle-catalog';
import { asRecord, asString } from '@/lib/paddle-data';
import { prepareCreditDiscount, releaseCreditOperation, detachCreditDiscount, assertNoPendingSubscriptionCredits, creditAmount } from '@/lib/credit-billing';
import { planChangeItems, type ProviderSubscription } from '@/lib/billing-rules';

async function target(userId: string, planId: string, subscriptionId?: string) {
    const plan = await db.query.plan.findFirst({ where: and(eq(schema.plan.id, planId), eq(schema.plan.isActive, true)) });
    if (!plan?.paddlePriceId || plan.priceAmount == null) throw new Error('This plan is not available for online billing.');
    const matches = await db.query.subscription.findMany({
        where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.productId, plan.productId), subscriptionId ? eq(schema.subscription.paddleSubscriptionId, subscriptionId) : undefined),
        with: { plan: true },
    });
    if (matches.length !== 1) throw new Error('Choose the site whose plan you want to change.');
    const subscription = matches[0];
    if (!subscription?.paddleSubscriptionId || !subscription.plan.paddlePriceId) throw new Error('No paid subscription was found.');
    if (subscription.planId === planId) throw new Error('You are already subscribed to this plan.');
    return { plan, subscription };
}

export async function previewPlanChange(userId: string, planId: string, useCredits = true, subscriptionId?: string) {
    const { plan, subscription } = await target(userId, planId, subscriptionId);
    if (subscription.siteId) await controller.sites.changePlan(subscription.siteId, userId, {
        dry_run: true, plan_id: plan.id, plan_name: plan.name, plan_vcpu: plan.vcpu,
        plan_ram_mb: plan.ramMb, plan_storage_gb: plan.storageGb, plan_user_limit: plan.userLimit,
    });
    await db.transaction(async (tx) => { await assertNoPendingSubscriptionCredits(tx, subscription.paddleSubscriptionId!); });
    const current = await paddleRequest(`/subscriptions/${subscription.paddleSubscriptionId}`) as ProviderSubscription;
    if (current.customer_id !== subscription.paddleCustomerId) throw new Error('Billing ownership could not be verified.');
    const request = {
        items: planChangeItems(current, subscription.plan.paddlePriceId!, plan.paddlePriceId!),
        proration_billing_mode: 'prorated_immediately',
        on_payment_failure: 'prevent_change',
        custom_data: { ...current.custom_data, userId, planId },
    };
    const preview = await paddleRequest(`/subscriptions/${current.id}/preview`, { method: 'PATCH', body: JSON.stringify(request) });
    const [operation] = await db.insert(schema.billingOperation).values({
        userId, subscriptionId: current.id, planId, request, preview,
        expectedUpdatedAt: current.updated_at, expiresAt: new Date(Date.now() + 120_000),
    }).returning();
    try {
        let finalPreview = preview;
        let used = 0;
        const baseline = asRecord(asRecord(asRecord(asRecord(preview).immediate_transaction).details).totals);
        const currency = asString(baseline.currency_code) ?? asString(asRecord(asRecord(asRecord(preview).update_summary).result).currency_code);
        const subtotal = typeof baseline.subtotal === 'string' && /^\d+$/.test(baseline.subtotal) ? creditAmount(baseline.subtotal) : 0;
        if (useCredits && !current.discount && currency && subtotal > 0) {
            const redemption = await prepareCreditDiscount({ userId, operationId: operation.id, currency, maximum: subtotal, priceId: plan.paddlePriceId!, kind: 'UPGRADE', subscriptionId: current.id });
            if (redemption) {
                const creditedRequest = { ...request, discount: { id: redemption.paddleDiscountId, effective_from: 'immediately' } };
                const price = asRecord(await paddleRequest(`/prices/${plan.paddlePriceId}`));
                const quantity = request.items.find((item) => item.price_id === plan.paddlePriceId)?.quantity ?? 1;
                const maximumFaceAmount = creditAmount(asRecord(price.unit_price).amount) * quantity;
                if (!Number.isSafeInteger(maximumFaceAmount)) throw new Error('Plan credit amount is out of range.');
                let nominal = redemption.reservedAmount;
                let creditedPreview: unknown;
                // Flat discounts can themselves be prorated. Calibrate against Paddle's preview,
                // so a wallet that covers the delta can cover the whole delta, not just a fraction.
                for (let attempt = 0; attempt < 4; attempt++) {
                    creditedPreview = await paddleRequest(`/subscriptions/${current.id}/preview`, { method: 'PATCH', body: JSON.stringify(creditedRequest) });
                    const totals = asRecord(asRecord(asRecord(asRecord(creditedPreview).immediate_transaction).details).totals);
                    used = creditAmount(totals.discount ?? '0');
                    if (used === redemption.reservedAmount) break;
                    if (attempt === 3) break;
                    let nextNominal: number;
                    if (used > redemption.reservedAmount) nextNominal = Math.max(1, Math.floor(nominal * redemption.reservedAmount / used) - 1);
                    else nextNominal = Math.min(maximumFaceAmount, used ? Math.floor(nominal * redemption.reservedAmount / used) : maximumFaceAmount);
                    if (nextNominal === nominal) break;
                    nominal = nextNominal;
                    await paddleRequest(`/discounts/${redemption.paddleDiscountId}`, { method: 'PATCH', body: JSON.stringify({ amount: String(nominal) }) });
                }
                if (used > redemption.reservedAmount) throw new Error('The credit preview exceeds the reserved balance.');
                if (used > 0) {
                    finalPreview = creditedPreview;
                    await db.update(schema.billingOperation).set({ request: creditedRequest, preview: creditedPreview }).where(eq(schema.billingOperation.id, operation.id));
                } else await releaseCreditOperation(operation.id);
            }
        }
        return { operationId: operation.id, preview: finalPreview, creditsApplied: used, expiresAt: operation.expiresAt.toISOString() };
    } catch (error) {
        await db.update(schema.billingOperation).set({ status: 'FAILED', error: 'Credit preview could not be prepared.' }).where(eq(schema.billingOperation.id, operation.id));
        try { await releaseCreditOperation(operation.id); } catch { /* Maintenance retries. */ }
        throw error;
    }
}

export async function commitPlanChange(userId: string, operationId: string) {
    const operation = await db.query.billingOperation.findFirst({
        where: and(eq(schema.billingOperation.id, operationId), eq(schema.billingOperation.userId, userId)),
    });
    if (!operation) throw new Error('Plan change not found.');
    if (operation.status === 'SUCCEEDED') return;
    if (operation.status !== 'QUOTED') throw new Error('This change is being checked. Refresh before trying again.');
    if (operation.expiresAt.getTime() < Date.now()) throw new Error('This preview expired. Preview the change again.');
    const { subscription, plan } = await target(userId, operation.planId, operation.subscriptionId);
    if (subscription.paddleSubscriptionId !== operation.subscriptionId) throw new Error('Your subscription has changed.');
    const [claimed] = await db.update(schema.billingOperation).set({ status: 'PROCESSING', updatedAt: new Date() })
        .where(and(eq(schema.billingOperation.id, operationId), eq(schema.billingOperation.status, 'QUOTED'), sql`${schema.billingOperation.expiresAt} > timezone('UTC', now())`)).returning();
    if (!claimed) throw new Error('This change is already being processed.');
    const redemption = await db.query.creditRedemption.findFirst({ where: and(eq(schema.creditRedemption.operationId, operationId), eq(schema.creditRedemption.status, 'RESERVED')) });
    if (redemption) await db.update(schema.creditRedemption).set({ cleanupRequired: true }).where(eq(schema.creditRedemption.id, redemption.id));
    let sent = false;
    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${operation.subscriptionId}`}, 0))`);
            await assertNoPendingSubscriptionCredits(tx, operation.subscriptionId, operationId);
            const current = await paddleRequest(`/subscriptions/${operation.subscriptionId}`) as ProviderSubscription;
            if (current.updated_at !== operation.expectedUpdatedAt || current.status !== 'active' || current.scheduled_change) {
                throw new Error('Your subscription changed after this preview. Preview it again.');
            }
            if (subscription.siteId) await controller.sites.changePlan(subscription.siteId, userId, {
                dry_run: true, plan_id: plan.id, plan_name: plan.name, plan_vcpu: plan.vcpu,
                plan_ram_mb: plan.ramMb, plan_storage_gb: plan.storageGb, plan_user_limit: plan.userLimit,
            });
            sent = true;
            await paddleRequest(`/subscriptions/${operation.subscriptionId}`, { method: 'PATCH', body: JSON.stringify(operation.request) });
            await tx.update(schema.billingOperation).set({ status: 'SUCCEEDED', updatedAt: new Date() }).where(eq(schema.billingOperation.id, operationId));
        });
    } catch (error) {
        // Network errors and 5xx may occur after Paddle accepted the mutation. Never retry blindly.
        const uncertain = sent && !(error instanceof PaddleApiError && [400, 401, 403, 404, 422].includes(error.status));
        await db.update(schema.billingOperation).set({ status: uncertain ? 'UNKNOWN' : 'FAILED', error: uncertain ? 'Provider outcome requires reconciliation.' : 'Provider rejected the change or the preview is stale.', updatedAt: new Date() })
            .where(eq(schema.billingOperation.id, operationId));
        if (!uncertain && redemption) { try { await releaseCreditOperation(operationId); } catch { /* Maintenance retries. */ } }
        if (uncertain) throw new Error('The billing result is being checked. Do not submit another change yet.');
        throw error;
    }
    if (redemption) { try { await detachCreditDiscount(redemption.id); } catch { /* Block further mutations until maintenance removes it. */ } }
}

export async function customerPortal(userId: string, subscriptionId: string) {
    const subscription = await db.query.subscription.findFirst({
        where: and(eq(schema.subscription.id, subscriptionId), eq(schema.subscription.userId, userId)),
    });
    if (!subscription?.paddleCustomerId || !subscription.paddleSubscriptionId) throw new Error('No Paddle subscription was found.');
    const session = asRecord(await paddleRequest(`/customers/${subscription.paddleCustomerId}/portal-sessions`, {
        method: 'POST', body: JSON.stringify({ subscription_ids: [subscription.paddleSubscriptionId] }),
    }));
    const url = asString(asRecord(asRecord(session.urls).general).overview);
    if (!url) throw new Error('The billing portal is unavailable.');
    return url;
}
