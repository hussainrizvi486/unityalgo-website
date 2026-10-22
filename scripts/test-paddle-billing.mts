/** Isolated integration tests. Refuses to use the application's configured database. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const url = process.env.BILLING_TEST_DATABASE_URL;
if (!url || new URL(url).port !== '55439' || new URL(url).hostname !== '127.0.0.1') {
    throw new Error('Set BILLING_TEST_DATABASE_URL to the isolated localhost:55439 test database.');
}
const databaseName = `billing_test_${randomUUID().replaceAll('-', '')}`;
const adminPool = new Pool({ connectionString: url });
await adminPool.query(`CREATE DATABASE "${databaseName}"`);
const testUrl = new URL(url);
testUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = testUrl.toString();
process.env.PADDLE_API_KEY = 'test_key';
process.env.PADDLE_WEBHOOK_SECRET = 'test_secret';
process.env.SESSION_SECRET = 'test-site-encryption-secret-at-least-32-characters';
process.env.CONTROLLER_INTERNAL_API_KEY = 'test-controller-key';
const pool = new Pool({ connectionString: testUrl.toString() });
const journal = JSON.parse(await readFile(new URL('../db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
for (const entry of journal.entries) {
    const migration = await readFile(new URL(`../db/migrations/${entry.tag}.sql`, import.meta.url), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await pool.query(statement);
}
await pool.end();
const { db, schema, closeDb } = await import('../lib/db');
const { eq } = await import('drizzle-orm');
const { planChangeItems, moneyFromMinor, moneyToMinor, providerStatus } = await import('../lib/billing-rules');
const { reserveCustomerCredits, releaseCustomerCredits, settleCustomerCredits, grantCustomerCredit } = await import('../lib/customer-credits');
const { previewPlanChange, commitPlanChange } = await import('../lib/subscription-billing');
const { prepareRenewalCredits, cancelRenewalCredits, maintainCreditRedemptions } = await import('../lib/credit-billing');
const { purchaseApp, cancelPurchase } = await import('../lib/app-billing');
const { CheckoutError } = await import('../lib/billing-errors');
const { createPlanCheckout, cancelPendingCheckout, ensurePaddleCustomer } = await import('../lib/checkout-billing');
const { processPaddleEvent, reconcilePaddleSubscription, recoverStalledBillingOperations } = await import('../lib/paddle-sync');
const { saveSiteOrder, startSiteOrderPayment, confirmSiteOrderPayment, provisionSiteOrder, drainSiteOrders, cancelSiteOrder, expireSiteOrders } = await import('../lib/site-orders');
const { syncSiteBilling, assertSiteBillingAccess } = await import('../lib/site-billing-lifecycle');
const { sealSiteSetup, openSiteSetup } = await import('../lib/site-order-secrets');
const { POST } = await import('../app/api/paddle/webhook/route');
const { GET: billingHealth, POST: runWorkerRoute } = await import('../app/api/internal/billing/route');
const realFetch = globalThis.fetch;
let patches = 0, transactionCreates = 0;
let hostingReady = true, hostingFailure = false, siteCreateCalls = 0;
let sitePlanChanges = 0, siteDeactivations = 0, siteReactivations = 0;
const siteFixtures = new Map<string, { id: string; name: string; status: string; activity: string | null; plan_id: string }>();
const createdSites = new Map<string, { id: string; name: string }>();
let failPayment = false, timeoutPayment = false;
let rejectCheckout = false, timeoutCheckout = false;
let customerConflict = false, conflictHint = true, customerEmail = 'customer@test.invalid', customerStatus = 'active', customerCreates = 0, customerRestores = 0;
let current = {
    id: 'sub_test', customer_id: 'ctm_test', status: 'active', updated_at: '2026-10-01T00:00:00Z',
    current_billing_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
    scheduled_change: null, currency_code: 'USD', next_billed_at: '2099-11-01T00:00:00Z', discount: null as null | { id: string }, custom_data: { userId: 'customer', planId: 'basic' },
    items: [{ price: { id: 'pri_basic' }, quantity: 2 }, { price: { id: 'pri_addon' }, quantity: 3 }],
};
const discounts = new Map<string, { id: string; amount: string; status?: string }>();
let discountCreates = 0;
const historicalSubscriptions = new Map<string, unknown>();
const transactions = new Map<string, Record<string, unknown>>();
const adjustments = new Map<string, Record<string, unknown>>();
function response(data: unknown, status = 200) { return new Response(JSON.stringify(status < 400 ? { data } : { error: { detail: 'Declined' } }), { status }); }
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/sites/capabilities') return Response.json({ configured: hostingReady, accepting: hostingReady, apps: [], domain_suffix: 'test.invalid' });
    if (path === '/api/v1/sites/check-slug') return Response.json({ available: true });
    if (path === '/api/v1/sites/trials') return Response.json({ used_plan_ids: [] });
    if (path === '/api/v1/sites' && method === 'POST') {
        siteCreateCalls++;
        if (hostingFailure) return Response.json({ error: 'Hosting offline' }, { status: 503 });
        const setup = JSON.parse(String(init?.body));
        assert.ok(setup.owner_password);
        const site = createdSites.get(setup.request_key) ?? { id: `site-${createdSites.size + 1}`, name: setup.name };
        createdSites.set(setup.request_key, site);
        siteFixtures.set(site.id, { ...site, status: 'ready', activity: null, plan_id: setup.plan_id });
        return Response.json(site);
    }
    if (path.startsWith('/api/v1/sites/')) {
        if (hostingFailure) return Response.json({ error: 'Hosting offline' }, { status: 503 });
        const id = path.split('/')[4];
        const site = siteFixtures.get(id)!;
        if (!site) throw new Error(`Missing site fixture ${id}`);
        if (method === 'GET') return Response.json(site);
        if (path.endsWith('/change-plan')) {
            const body = JSON.parse(String(init?.body));
            if (!body.dry_run) { sitePlanChanges++; site.plan_id = body.plan_id; }
            return Response.json({ queued: true });
        }
        if (path.endsWith('/deactivate')) { siteDeactivations++; site.status = 'deactivated'; return Response.json({ queued: true }); }
        if (path.endsWith('/reactivate')) { siteReactivations++; site.status = 'ready'; return Response.json({ queued: true }); }
    }
    if (path.startsWith('/prices/') && method === 'GET') return response({ id: path.split('/').at(-1), unit_price: { amount: '3000', currency_code: 'USD' }, billing_cycle: { interval: 'month', frequency: 1 }, trial_period: null });
    if (path === '/discounts' && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const discount = { id: `dsc_test${++discountCreates}`, ...body };
        discounts.set(discount.id, discount);
        assert.equal(body.enabled_for_checkout, false);
        assert.equal(body.usage_limit, 1);
        return response(discount);
    }
    if (path.startsWith('/discounts/') && method === 'PATCH') {
        const discount = discounts.get(path.split('/').at(-1)!);
        if (!discount) throw new Error('Missing discount fixture');
        Object.assign(discount, JSON.parse(String(init?.body)));
        return response(discount);
    }
    if (path === `/subscriptions/${current.id}/preview`) {
        const body = JSON.parse(String(init?.body));
        const discount = discounts.get(body.discount?.id);
        const renewal = body.discount?.effective_from === 'next_billing_period';
        const applied = discount ? Math.floor(Number(discount.amount) * (renewal ? 1 : 0.5)) : 0;
        const totals = { balance: String((renewal ? 3000 : 1500) - applied), grand_total: String((renewal ? 3000 : 1500) - applied), subtotal: renewal ? '3000' : '1500', discount: String(applied), currency_code: 'USD' };
        return response({ immediate_transaction: { currency_code: 'USD', details: { totals } }, next_transaction: { details: { totals } }, update_summary: { result: { action: 'charge', amount: totals.grand_total, currency_code: 'USD' } } });
    }
    if (path === `/subscriptions/${current.id}` && method === 'GET') return response({ ...current, next_transaction: { details: { totals: { subtotal: '3000', currency_code: 'USD' } } } });
    if (path.startsWith('/subscriptions/') && method === 'GET' && historicalSubscriptions.has(path.split('/').at(-1)!)) return response(historicalSubscriptions.get(path.split('/').at(-1)!));
    if (path === `/subscriptions/${current.id}` && method === 'PATCH') {
        const body = JSON.parse(String(init?.body));
        if (body.items) {
            patches++;
            if (timeoutPayment) throw new TypeError('Network outcome unknown');
            if (failPayment) return response(null, 400);
            assert.equal(body.proration_billing_mode, 'prorated_immediately');
            assert.equal(body.on_payment_failure, 'prevent_change');
        } else assert.equal(body.proration_billing_mode, 'do_not_bill');
        current = { ...current, updated_at: new Date(Date.parse(current.updated_at) + 1000).toISOString(),
            ...(body.custom_data ? { custom_data: body.custom_data } : {}),
            ...('discount' in body ? { discount: body.discount ? { id: body.discount.id } : null } : {}),
            ...(body.items ? { items: body.items.map((item: { price_id: string; quantity: number }) => ({ price: { id: item.price_id }, quantity: item.quantity })) } : {}),
        };
        return response(current);
    }
    if (path.endsWith('/credit-balances')) return response([{ currency_code: 'USD', balance: { available: '500', reserved: '0', used: '0' } }]);
    if (path === '/transactions' && method === 'POST') {
        transactionCreates++;
        if (rejectCheckout) return Response.json({ error: { detail: 'Invalid request.', code: 'invalid_field', errors: [{ field: 'items', message: 'Invalid price.' }] }, meta: { request_id: 'test-checkout-request' } }, { status: 400 });
        const body = JSON.parse(String(init?.body));
        const data = { id: `txn_checkout${transactionCreates}`, status: 'draft', ...body };
        transactions.set(data.id, data);
        if (timeoutCheckout) throw new Error('Provider response lost after accepting the transaction.');
        return response(data);
    }
    if (path.startsWith('/transactions/')) {
        const data = transactions.get(path.split('/').at(-1)!);
        if (!data) throw new Error(`Missing transaction fixture: ${path}`);
        if (method === 'PATCH') Object.assign(data, JSON.parse(String(init?.body)));
        return response(data);
    }
    if (path.startsWith('/adjustments/')) return response(adjustments.get(path.split('/').at(-1)!));
    if (path === '/customers' && method === 'POST') {
        customerCreates++;
        if (customerConflict) return Response.json({ error: { code: 'customer_already_exists', detail: conflictHint ? 'customer email conflicts with customer of id ctm_existing1' : 'customer email conflicts with an existing customer' } }, { status: 409 });
        return response({ id: 'ctm_created1' });
    }
    if (path === '/customers' && method === 'GET') return response([{ id: 'ctm_existing1', email: customerEmail, status: customerStatus }]);
    if (path === '/customers/ctm_existing1') {
        if (method === 'PATCH') { customerRestores++; customerStatus = 'active'; }
        return response({ id: 'ctm_existing1', email: customerEmail, status: customerStatus });
    }
    if (path === '/transactions' || path === '/adjustments') return response([]);
    throw new Error(`Unexpected provider request: ${method} ${path}`);
}) as typeof fetch;
let passed = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) { await fn(); passed++; console.log(`ok ${name}`); }
const event = async (id: string, type: string, providerId: string) => {
    await db.insert(schema.paddleEvent).values({ id, eventType: type, payload: { event_id: id, event_type: type, data: { id: providerId }, occurred_at: '2026-01-01T00:00:00Z' } });
    return processPaddleEvent(id);
};
try {
    await db.insert(schema.user).values([{ id: 'admin', email: 'admin@test.invalid', role: 'ADMIN', passwordHash: 'x' }, { id: 'customer', email: 'customer@test.invalid', role: 'CUSTOMER', passwordHash: 'x' }]);
    await db.insert(schema.product).values({ id: 'product', slug: 'test-product', label: 'Test product' });
    await db.insert(schema.plan).values([
        { id: 'basic', productId: 'product', name: 'Basic', slug: 'basic', priceAmount: 30, paddlePriceId: 'pri_basic' },
        { id: 'pro', productId: 'product', name: 'Pro', slug: 'pro', priceAmount: 60, paddlePriceId: 'pri_pro' },
    ]);
    await db.insert(schema.subscription).values({ userId: 'customer', planId: 'basic', productId: 'product', paddleSubscriptionId: 'sub_test', paddleCustomerId: 'ctm_test' });
    await check('currency precision and strict minor-unit parsing', () => {
        assert.equal(moneyFromMinor('123', 'JPY'), 123);
        assert.equal(moneyToMinor(1.23, 'USD'), '123');
        assert.equal(moneyFromMinor('1.5', 'USD'), null);
        assert.equal(moneyFromMinor('9007199254740993', 'USD'), null);
        assert.equal(providerStatus('paused'), 'PAUSED');
        assert.throws(() => providerStatus('unrecognized'));
    });
    await check('plan replacement preserves seat and add-on quantities', () => {
        assert.deepEqual(planChangeItems(current, 'pri_basic', 'pri_pro'), [{ price_id: 'pri_pro', quantity: 2 }, { price_id: 'pri_addon', quantity: 3 }]);
        assert.throws(() => planChangeItems({ ...current, status: 'past_due' }, 'pri_basic', 'pri_pro'));
        assert.throws(() => planChangeItems({ ...current, scheduled_change: {} }, 'pri_basic', 'pri_pro'));
    });
    await check('concurrent duplicate credit grants produce one ledger entry', async () => {
        const input = { userId: 'customer', actorId: 'admin', currency: 'USD', amount: 1000, reason: 'Support allowance', operationKey: 'grant-1' };
        const [a, b] = await Promise.all([grantCustomerCredit(input), grantCustomerCredit(input)]);
        assert.equal(a.id, b.id);
        assert.equal((await db.query.creditAccount.findFirst())?.available, 1000);
        await assert.rejects(grantCustomerCredit({ ...input, amount: 2000 }), /already been used/);
    });
    await check('failed payment prevents an upgrade and marks operation failed', async () => {
        const quote = await previewPlanChange('customer', 'pro', false); failPayment = true;
        await assert.rejects(commitPlanChange('customer', quote.operationId), /Declined/); failPayment = false;
        assert.equal(current.items[0].price.id, 'pri_basic');
        assert.equal((await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, quote.operationId) }))?.status, 'FAILED');
    });
    await check('a stale preview cannot charge', async () => {
        const quote = await previewPlanChange('customer', 'pro', false);
        current.updated_at = '2026-10-21T00:00:00Z'; const before = patches;
        await assert.rejects(commitPlanChange('customer', quote.operationId), /changed after/);
        assert.equal(patches, before);
    });
    await check('concurrent upgrade confirmations send one mutation', async () => {
        const quote = await previewPlanChange('customer', 'pro', false); const before = patches;
        await Promise.allSettled([commitPlanChange('customer', quote.operationId), commitPlanChange('customer', quote.operationId)]);
        assert.equal(patches, before + 1);
        assert.equal(current.items[0].price.id, 'pri_pro');
    });
    await check('duplicate and stale events use the canonical plan, not old custom metadata', async () => {
        current.custom_data.planId = 'basic';
        await db.insert(schema.paddleEvent).values({ id: 'evt-upgrade', eventType: 'subscription.updated', payload: { event_id: 'evt-upgrade', event_type: 'subscription.updated', data: { id: 'sub_test', status: 'canceled' } } });
        assert.deepEqual(await Promise.all([processPaddleEvent('evt-upgrade'), processPaddleEvent('evt-upgrade')]), [true, true]);
        const local = await db.query.subscription.findFirst();
        assert.equal(local?.planId, 'pro'); assert.equal(local?.status, 'ACTIVE');
        assert.equal((await db.query.billingFulfillment.findMany()).length, 1);
    });
    transactions.set('txn_test', { id: 'txn_test', subscription_id: 'sub_test', customer_id: 'ctm_test', currency_code: 'USD', status: 'completed', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-22T00:00:00Z', details: { totals: { grand_total: '6000', discount: '0' } } });
    await check('completed transaction mirrors native credits without reactivating cancellation', async () => {
        current.status = 'canceled'; current.updated_at = '2026-10-23T00:00:00Z';
        assert.equal(await event('evt-payment', 'transaction.completed', 'txn_test'), true);
        assert.equal((await db.query.subscription.findFirst())?.status, 'CANCELED');
        assert.equal((await db.query.billingRecord.findFirst())?.amount, 60);
        assert.ok(await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, 'credits:ctm_test') }));
    });
    await check('multiple approved refunds accumulate; pending refunds do not count', async () => {
        for (const [id, amount, status] of [['adj_one', '2000', 'approved'], ['adj_two', '4000', 'approved'], ['adj_pending', '500', 'pending_approval']]) {
            adjustments.set(id, { id, action: 'refund', status, transaction_id: 'txn_test', created_at: '2026-10-22T00:00:00Z', updated_at: '2026-10-22T00:00:00Z', totals: { total: amount } });
            assert.equal(await event(`evt-${id}`, 'adjustment.updated', id), true);
        }
        const billing = await db.query.billingRecord.findFirst();
        assert.equal(billing?.refundedAmount, 60); assert.equal(billing?.status, 'REFUNDED');
        await event('evt-old-payment', 'transaction.updated', 'txn_test');
        assert.equal((await db.query.billingRecord.findFirst())?.status, 'REFUNDED');
    });
    await check('unresolved ownership is retried instead of silently discarded', async () => {
        const oldId = current.id; current.id = 'sub_unknown';
        // Request has no provider fixture, so this must remain retryable.
        assert.equal(await event('evt-unresolved', 'subscription.created', 'sub_unknown'), false);
        assert.equal((await db.query.paddleEvent.findFirst({ where: eq(schema.paddleEvent.id, 'evt-unresolved') }))?.status, 'FAILED');
        current.id = oldId;
    });
    await check('signed webhook persists once and does not call provider during acknowledgment', async () => {
        const raw = JSON.stringify({ event_id: 'evt-inbox', event_type: 'subscription.updated', data: { id: 'sub_test' } });
        const ts = Math.floor(Date.now() / 1000);
        const sig = createHmac('sha256', 'test_secret').update(`${ts}:${raw}`).digest('hex');
        const request = () => new Request('http://localhost/api/paddle/webhook', { method: 'POST', body: raw, headers: { 'paddle-signature': `ts=${ts};h1=${sig}` } });
        assert.equal((await POST(request())).status, 200); assert.equal((await POST(request())).status, 200);
        assert.equal((await db.query.paddleEvent.findFirst({ where: eq(schema.paddleEvent.id, 'evt-inbox') }))?.status, 'PENDING');
        assert.equal((await POST(new Request('http://localhost', { method: 'POST', body: raw }))).status, 401);
    });
    await check('network uncertainty blocks another upgrade until canonical reconciliation', async () => {
        current.status = 'active'; current.items[0].price.id = 'pri_basic';
        await db.update(schema.subscription).set({ planId: 'basic', status: 'ACTIVE' });
        const quote = await previewPlanChange('customer', 'pro', false); timeoutPayment = true;
        await assert.rejects(commitPlanChange('customer', quote.operationId), /being checked/); timeoutPayment = false;
        const next = await previewPlanChange('customer', 'pro', false); const before = patches;
        await assert.rejects(commitPlanChange('customer', next.operationId)); assert.equal(patches, before);
        current.items[0].price.id = 'pri_pro'; current.updated_at = '2026-10-24T00:00:00Z';
        await reconcilePaddleSubscription('sub_test');
        assert.equal((await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, quote.operationId) }))?.status, 'SUCCEEDED');
    });
    await check('checkout reuses the same transaction and refuses active subscriptions', async () => {
        await assert.rejects(createPlanCheckout('customer', 'pro', false), /already have/);
        await db.update(schema.subscription).set({ status: 'CANCELED' });
        await db.insert(schema.billingProviderRecord).values({ id: 'customer:customer', kind: 'CUSTOMER', userId: 'customer', payload: { customerId: 'ctm_test' }, providerUpdatedAt: new Date() });
        const [a, b] = await Promise.allSettled([createPlanCheckout('customer', 'basic', false), createPlanCheckout('customer', 'basic', false)]);
        const successful = [a, b].find((r) => r.status === 'fulfilled');
        assert.ok(successful && successful.status === 'fulfilled');
        assert.equal(transactionCreates, 1);
        assert.equal(await createPlanCheckout('customer', 'basic', false), successful.value);
    });
    await check('an existing Paddle customer with the same email is reused instead of failing checkout', async () => {
        assert.equal(await ensurePaddleCustomer('customer', 'customer@test.invalid'), 'ctm_created1');
        customerConflict = true;
        assert.equal(await ensurePaddleCustomer('customer', 'customer@test.invalid'), 'ctm_existing1');
        conflictHint = false;
        assert.equal(await ensurePaddleCustomer('customer', 'customer@test.invalid'), 'ctm_existing1');
        customerEmail = 'someone-else@test.invalid';
        await assert.rejects(ensurePaddleCustomer('customer', 'customer@test.invalid'), /conflicts/);
        customerEmail = 'customer@test.invalid'; customerStatus = 'archived';
        assert.equal(await ensurePaddleCustomer('customer', 'customer@test.invalid'), 'ctm_existing1');
        assert.equal(customerRestores, 1);
        customerConflict = false; conflictHint = true; customerStatus = 'active';
    });
    await check('initial subscription ownership follows server-created transaction linkage', async () => {
        const checkout = transactions.get('txn_checkout1')!;
        transactions.set('txn_checkout1', { ...checkout, subscription_id: 'sub_initial', status: 'completed',
            created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z', currency_code: 'USD',
            items: [{ price: { id: 'pri_basic' }, quantity: 1 }], details: { totals: { grand_total: '3000' } },
        });
        historicalSubscriptions.set('sub_test', { ...structuredClone(current), status: 'canceled' });
        current = { ...current, id: 'sub_initial', updated_at: '2026-10-25T00:00:00Z', items: [{ price: { id: 'pri_basic' }, quantity: 1 }] };
        assert.equal(await event('evt-initial', 'transaction.completed', 'txn_checkout1'), true);
        const subscription = await db.query.subscription.findFirst();
        assert.equal(subscription?.paddleSubscriptionId, 'sub_initial');
        assert.equal(subscription?.planId, 'basic');
    });
    await check('app billing rejects an uncertain plan change before changing provider items', async () => {
        const [app] = await db.insert(schema.appCatalog).values({ name: 'Paid test', slug: 'paid-test', description: 'Test', category: 'Test', priceAmount: 5, paddlePriceId: 'pri_addon' }).returning();
        const [operation] = await db.insert(schema.billingOperation).values({ userId: 'customer', subscriptionId: 'sub_initial', planId: 'pro', status: 'UNKNOWN', request: {}, preview: {}, expectedUpdatedAt: current.updated_at, expiresAt: new Date() }).returning();
        const before = patches;
        await db.update(schema.subscription).set({ siteId: 'site-one' }).where(eq(schema.subscription.userId, 'customer'));
        await assert.rejects(purchaseApp({ userId: 'customer', app, siteId: 'site-one' }), /being checked/);
        assert.equal(patches, before);
        await db.update(schema.subscription).set({ siteId: null }).where(eq(schema.subscription.userId, 'customer'));
        await db.update(schema.billingOperation).set({ status: 'FAILED' }).where(eq(schema.billingOperation.id, operation.id));
        process.env.APP_BILLING_MODE = 'test';
        const purchase = await purchaseApp({ userId: 'customer', app, siteId: 'site-test' });
        assert.equal(purchase.billingMode, 'test');
        assert.equal((await purchaseApp({ userId: 'customer', app, siteId: 'site-test' })).id, purchase.id);
        await cancelPurchase(purchase);
        assert.equal((await db.query.appPurchase.findFirst({ where: eq(schema.appPurchase.id, purchase.id) }))?.status, 'CANCELED');
        delete process.env.APP_BILLING_MODE;
    });
    await check('reversed refund updates restore the remaining approved refund total', async () => {
        // Refunds stay attached to the prior subscription after a customer subscribes again.
        adjustments.set('adj_two', { ...adjustments.get('adj_two'), status: 'reversed', updated_at: '2026-10-26T00:00:00Z' });
        assert.equal(await event('evt-reversed', 'adjustment.updated', 'adj_two'), true);
        const record = await db.query.billingRecord.findFirst({ where: eq(schema.billingRecord.invoiceNumber, 'txn_test') });
        assert.equal(record?.refundedAmount, 20);
        assert.equal(record?.status, 'PAID');
        assert.equal((await db.query.subscription.findFirst())?.paddleSubscriptionId, 'sub_initial');
        assert.equal((await db.query.subscription.findFirst())?.status, 'ACTIVE');
    });
    await check('unfinished checkout cancellation permits another plan without canceling a paid invoice', async () => {
        await db.update(schema.subscription).set({ status: 'CANCELED' });
        const id = await createPlanCheckout('customer', 'basic', false);
        await assert.rejects(createPlanCheckout('customer', 'pro', false), /Finish or cancel/);
        await cancelPendingCheckout('customer', 'basic');
        assert.equal(transactions.get(id)?.status, 'canceled');
        const next = await createPlanCheckout('customer', 'pro', false);
        assert.notEqual(next, id);
        Object.assign(transactions.get(next)!, { status: 'completed' });
        await assert.rejects(cancelPendingCheckout('customer', 'pro'), /already progressed/);
    });
    await check('another customer cannot confirm an operation they do not own', async () => {
        await assert.rejects(commitPlanChange('admin', (await db.query.billingOperation.findFirst())!.id), /not found/);
    });
    await check('a crashed checkout operation becomes uncertain without retrying payment', async () => {
        const [operation] = await db.insert(schema.billingOperation).values({ userId: 'customer', subscriptionId: 'checkout:crashed', planId: 'basic', status: 'PROCESSING', request: {}, preview: {}, expectedUpdatedAt: '', expiresAt: new Date(), updatedAt: new Date(Date.now() - 600_000) }).returning();
        const before = transactionCreates;
        await recoverStalledBillingOperations();
        assert.equal((await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, operation.id) }))?.status, 'UNKNOWN');
        assert.equal(transactionCreates, before);
    });
    await check('concurrent reservations cannot overspend a wallet and settle only once', async () => {
        const ops = await db.insert(schema.billingOperation).values(['one', 'two'].map((suffix) => ({ userId: 'customer', subscriptionId: `wallet:${suffix}`, planId: 'basic', request: {}, preview: {}, expectedUpdatedAt: '', expiresAt: new Date(Date.now() + 60_000) }))).returning();
        const [a, b] = await Promise.all(ops.map((op) => reserveCustomerCredits({ userId: 'customer', currency: 'USD', maximum: 700, operationId: op.id, kind: 'CHECKOUT' })));
        assert.ok(a && b);
        assert.equal(a.reservedAmount + b.reservedAmount, 1000);
        const used = Math.min(a.reservedAmount, 600);
        const settle = () => db.transaction((tx) => settleCustomerCredits(tx, { redemptionId: a.id, transactionId: 'txn_wallet', currency: 'USD', discountAmount: used }));
        await Promise.all([settle(), settle()]);
        await db.transaction((tx) => releaseCustomerCredits(tx, b.id));
        const account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'customer') });
        assert.equal(account?.available, 1000 - used); assert.equal(account?.reserved, 0);
        assert.equal((await db.query.creditEntry.findMany({ where: eq(schema.creditEntry.operationKey, `consume:${a.id}`) })).length, 1);
    });
    async function creditCustomer(id: string, amount: number) {
        await db.insert(schema.user).values({ id, email: `${id}@test.invalid`, role: 'CUSTOMER', passwordHash: 'x' });
        await db.insert(schema.billingProviderRecord).values({ id: `customer:${id}`, kind: 'CUSTOMER', userId: id, payload: { customerId: `ctm_${id}` }, providerUpdatedAt: new Date() });
        await grantCustomerCredit({ userId: id, actorId: 'admin', currency: 'USD', amount, reason: 'Plan allowance', operationKey: `grant:${id}` });
    }
    async function switchSubscription(userId: string, subscriptionId: string) {
        historicalSubscriptions.set(current.id, structuredClone(current));
        current = { ...current, id: subscriptionId, customer_id: `ctm_${userId}`, status: 'active', discount: null,
            updated_at: '2026-10-27T00:00:00Z', items: [{ price: { id: 'pri_basic' }, quantity: 1 }], custom_data: { userId, planId: 'basic' } };
    }
    await check('partial plan credits are attached to checkout and consumed after completed payment', async () => {
        await creditCustomer('credit-partial', 1000);
        const id = await createPlanCheckout('credit-partial', 'basic');
        const transaction = transactions.get(id)!;
        assert.ok(transaction.discount_id);
        let account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-partial') });
        assert.equal(account?.available, 0); assert.equal(account?.reserved, 1000);
        await switchSubscription('credit-partial', 'sub_partial');
        Object.assign(transaction, { subscription_id: current.id, status: 'completed', currency_code: 'USD', created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z', items: current.items, details: { totals: { grand_total: '2000', discount: '1000' } } });
        assert.equal(await event('evt-credit-partial', 'transaction.completed', id), true);
        assert.equal(await event('evt-credit-partial-duplicate', 'transaction.updated', id), true);
        account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-partial') });
        assert.equal(account?.reserved, 0); assert.equal(account?.available, 0);
    });
    let fullTransactionId = '';
    await check('full credit purchases keep surplus credits and still synchronize an active plan', async () => {
        await creditCustomer('credit-full', 5000);
        fullTransactionId = await createPlanCheckout('credit-full', 'basic');
        const transaction = transactions.get(fullTransactionId)!;
        const discount = discounts.get(String(transaction.discount_id))!;
        assert.equal(discount.amount, '3000');
        await switchSubscription('credit-full', 'sub_full');
        Object.assign(transaction, { subscription_id: current.id, status: 'completed', currency_code: 'USD', created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z', items: current.items, details: { totals: { grand_total: '0', discount: '3000' } } });
        assert.equal(await event('evt-credit-full', 'transaction.completed', fullTransactionId), true);
        const account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') });
        assert.equal(account?.available, 2000); assert.equal(account?.reserved, 0);
        assert.equal((await db.query.subscription.findFirst({ where: eq(schema.subscription.userId, 'credit-full') }))?.status, 'ACTIVE');
    });
    await check('canceling a checkout archives its credit discount and returns all reserved credits', async () => {
        await creditCustomer('credit-cancel', 1000);
        const id = await createPlanCheckout('credit-cancel', 'basic');
        const discountId = String(transactions.get(id)!.discount_id);
        await cancelPendingCheckout('credit-cancel', 'basic');
        assert.equal(discounts.get(discountId)?.status, 'archived');
        const account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-cancel') });
        assert.equal(account?.available, 1000); assert.equal(account?.reserved, 0);
    });
    await check('prorated upgrades consume actual credit discount and remove it before another bill', async () => {
        const quote = await previewPlanChange('credit-full', 'pro');
        assert.equal(quote.creditsApplied, 1500);
        const redemption = (await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.operationId, quote.operationId) }))!;
        assert.equal(redemption.reservedAmount, 1500);
        await commitPlanChange('credit-full', quote.operationId);
        assert.equal(current.discount, null);
        transactions.set('txn_credit_upgrade', { id: 'txn_credit_upgrade', subscription_id: current.id, customer_id: current.customer_id, discount_id: redemption.paddleDiscountId, currency_code: 'USD', status: 'completed', created_at: current.updated_at, updated_at: current.updated_at, details: { totals: { grand_total: '0', discount: '1500' } } });
        assert.equal(await event('evt-credit-upgrade', 'transaction.completed', 'txn_credit_upgrade'), true);
        const account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') });
        assert.equal(account?.available, 500); assert.equal(account?.reserved, 0);
        assert.equal((await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, redemption.id) }))?.cleanupRequired, false);
    });
    await check('declined and expired credit upgrades restore reservations', async () => {
        current.items[0].price.id = 'pri_basic';
        await db.update(schema.subscription).set({ planId: 'basic' }).where(eq(schema.subscription.userId, 'credit-full'));
        const quote = await previewPlanChange('credit-full', 'pro'); failPayment = true;
        await assert.rejects(commitPlanChange('credit-full', quote.operationId), /Declined/); failPayment = false;
        assert.equal((await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') }))?.available, 500);
        const expired = await previewPlanChange('credit-full', 'pro');
        await db.update(schema.billingOperation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.billingOperation.id, expired.operationId));
        await maintainCreditRedemptions(100);
        assert.equal((await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') }))?.available, 500);
    });
    await check('scheduled renewal credits can be safely released before collection', async () => {
        const subscription = (await db.query.subscription.findFirst({ where: eq(schema.subscription.userId, 'credit-full') }))!;
        const scheduled = await prepareRenewalCredits('credit-full', subscription.id);
        assert.equal(scheduled.applied, 500);
        const redemption = (await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.paddleDiscountId, current.discount!.id) }))!;
        await assert.rejects(previewPlanChange('credit-full', 'pro'), /Credits are allocated/);
        await cancelRenewalCredits('credit-full', redemption.id);
        assert.equal(current.discount, null);
        assert.equal((await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') }))?.available, 500);
    });
    await check('a renewal consumes its reserved credit once and cleanup removes the recurring discount', async () => {
        const subscription = (await db.query.subscription.findFirst({ where: eq(schema.subscription.userId, 'credit-full') }))!;
        await prepareRenewalCredits('credit-full', subscription.id);
        const discountId = current.discount!.id;
        const redemption = (await db.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.paddleDiscountId, discountId) }))!;
        current.next_billed_at = '2099-12-01T00:00:00Z';
        await assert.rejects(cancelRenewalCredits('credit-full', redemption.id), /may already be processing/);
        transactions.set('txn_credit_renewal', { id: 'txn_credit_renewal', subscription_id: current.id, customer_id: current.customer_id, discount_id: discountId, currency_code: 'USD', status: 'completed', created_at: current.updated_at, updated_at: current.updated_at, details: { totals: { grand_total: '2500', discount: '500' } } });
        assert.equal(await event('evt-credit-renewal', 'transaction.completed', 'txn_credit_renewal'), true);
        await maintainCreditRedemptions(100);
        assert.equal(current.discount, null);
        const account = await db.query.creditAccount.findFirst({ where: eq(schema.creditAccount.userId, 'credit-full') });
        assert.equal(account?.available, 0); assert.equal(account?.reserved, 0);
    });
    await check('fresh operations are not classified as crashed in a non-UTC database timezone', async () => {
        const [fresh] = await db.insert(schema.billingOperation).values({ userId: 'customer', subscriptionId: 'checkout:fresh', planId: 'basic', status: 'PROCESSING', request: {}, preview: {}, expectedUpdatedAt: '', expiresAt: new Date(Date.now() + 120000), updatedAt: new Date() }).returning();
        await recoverStalledBillingOperations();
        assert.equal((await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, fresh.id) }))?.status, 'PROCESSING');
    });
    const setupValues = { slug: 'paid-order-one', companyName: 'Test Co', country: 'United States', currency: 'USD', coaType: 'standard', planId: 'basic', apps: [], email: 'owner@example.com', password: 'Test-site-password-2026!', confirmPassword: 'Test-site-password-2026!' };
    await db.update(schema.product).set({ slug: 'algosuite' }).where(eq(schema.product.id, 'product'));
    await db.insert(schema.currency).values({ code: 'USD', name: 'US Dollar', symbol: '$' });
    await creditCustomer('site-customer', 500);
    let siteOrderId = '', siteTransactionId = '';
    await check('site credentials are encrypted and bound to the setup owner', () => {
        const sealed = sealSiteSetup('owner:a', { owner_password: setupValues.password });
        assert.ok(!sealed.includes(setupValues.password));
        assert.equal(openSiteSetup('owner:a', sealed).owner_password, setupValues.password);
        assert.throws(() => openSiteSetup('owner:b', sealed));
    });
    await check('saving site details never starts provisioning and repeated submits reuse the draft', async () => {
        const key = randomUUID();
        const first = await saveSiteOrder('site-customer', key, setupValues);
        const repeated = await saveSiteOrder('site-customer', key, setupValues);
        siteOrderId = first.id;
        assert.equal(first.id, repeated.id); assert.equal(first.status, 'DRAFT');
        assert.equal(siteCreateCalls, 0);
        assert.ok(!first.encryptedSetup?.includes(setupValues.password));
        await provisionSiteOrder(first.id);
        assert.equal(siteCreateCalls, 0);
    });
    await check('hosting readiness and ownership are checked before any checkout is created', async () => {
        const before = transactionCreates;
        await assert.rejects(startSiteOrderPayment('customer', siteOrderId, false), /not found/);
        hostingReady = false;
        await assert.rejects(startSiteOrderPayment('site-customer', siteOrderId, false), /hosting is not ready/);
        hostingReady = true;
        assert.equal(transactionCreates, before); assert.equal(siteCreateCalls, 0);
    });
    await check('the final payment step creates a checkout bound to the immutable site setup', async () => {
        const result = await startSiteOrderPayment('site-customer', siteOrderId, false);
        assert.ok(result.transactionId); siteTransactionId = result.transactionId;
        assert.equal((transactions.get(siteTransactionId)!.custom_data as Record<string, string>).siteOrderId, siteOrderId);
        const order = (await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, siteOrderId) }))!;
        assert.equal(order.status, 'AWAITING_PAYMENT');
        const replay = await saveSiteOrder('site-customer', order.requestKey, { ...setupValues, companyName: 'Changed after checkout' });
        assert.equal((replay.summary as Record<string, string>).companyName, 'Test Co');
        await provisionSiteOrder(siteOrderId); assert.equal(siteCreateCalls, 0);
    });
    await check('client-style success claims and incomplete payments cannot authorize provisioning', async () => {
        const transaction = transactions.get(siteTransactionId)!;
        const fake = { ...transaction, id: siteTransactionId, status: 'completed', subscription_id: 'sub_site', items: [{ price: { id: 'pri_basic' }, quantity: 1 }], details: { totals: { balance: '100' } } };
        await assert.rejects(db.transaction((tx) => confirmSiteOrderPayment(tx, fake, 'site-customer')), /not fully settled/);
        await db.transaction((tx) => confirmSiteOrderPayment(tx, { ...fake, status: 'ready' }, 'site-customer'));
        await provisionSiteOrder(siteOrderId); assert.equal(siteCreateCalls, 0);
    });
    await check('confirmed Paddle payment queues the saved site and duplicate workers provision once', async () => {
        await switchSubscription('site-customer', 'sub_site');
        const transaction = transactions.get(siteTransactionId)!;
        Object.assign(transaction, { subscription_id: 'sub_site', status: 'completed', customer_id: current.customer_id, currency_code: 'USD', created_at: current.updated_at, updated_at: current.updated_at, items: current.items, details: { totals: { grand_total: '3000', discount: '0', balance: '0' } } });
        assert.equal(await event('evt-site-paid', 'transaction.completed', siteTransactionId), true);
        assert.equal((await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, siteOrderId) }))?.status, 'READY');
        await Promise.all([provisionSiteOrder(siteOrderId), provisionSiteOrder(siteOrderId)]);
        let order = (await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, siteOrderId) }))!;
        assert.equal(siteCreateCalls, 1); assert.equal(order.status, 'PROVISIONED'); assert.ok(order.siteId); assert.equal(order.encryptedSetup, null);
        assert.equal(await event('evt-site-paid-duplicate', 'transaction.updated', siteTransactionId), true);
        await provisionSiteOrder(siteOrderId); assert.equal(siteCreateCalls, 1);
        await db.transaction((tx) => confirmSiteOrderPayment(tx, { ...transaction, id: 'txn_later_renewal' }, 'site-customer'));
        order = (await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, siteOrderId) }))!;
        assert.equal(order.paddleTransactionId, siteTransactionId);
    });
    let secondOrderId = '';
    await check('two sites have independent paid subscriptions and hosting retries never recharge', async () => {
        const order = await saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'second-site' });
        secondOrderId = order.id;
        const before = transactionCreates;
        const result = await startSiteOrderPayment('site-customer', order.id, false);
        assert.ok(result.transactionId); assert.equal(transactionCreates, before + 1);
        await switchSubscription('site-customer', 'sub_second_site');
        const transaction = transactions.get(result.transactionId)!;
        Object.assign(transaction, { subscription_id: current.id, status: 'completed', customer_id: current.customer_id, currency_code: 'USD', created_at: current.updated_at, updated_at: current.updated_at, items: current.items, details: { totals: { grand_total: '3000', discount: '0', balance: '0' } } });
        assert.equal(await event('evt-second-site-paid', 'transaction.completed', result.transactionId), true);
        hostingFailure = true; await provisionSiteOrder(order.id); hostingFailure = false;
        const queued = (await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) }))!;
        assert.equal(queued.status, 'READY'); assert.ok(queued.paidAt); assert.ok(queued.encryptedSetup);
        await db.update(schema.siteOrder).set({ nextAttemptAt: new Date(0) }).where(eq(schema.siteOrder.id, order.id));
        await drainSiteOrders();
        assert.equal((await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) }))?.status, 'PROVISIONED');
        const subscriptions = await db.query.subscription.findMany({ where: eq(schema.subscription.userId, 'site-customer') });
        assert.equal(subscriptions.length, 2); assert.equal(new Set(subscriptions.map((sub) => sub.siteId)).size, 2);
        assert.equal(transactionCreates, before + 1);
    });
    await check('a site upgrade applies resources only after its own completed prorated payment', async () => {
        const sub = (await db.query.subscription.findFirst({ where: eq(schema.subscription.siteOrderId, secondOrderId) }))!;
        const before = sitePlanChanges;
        const quote = await previewPlanChange('site-customer', 'pro', false, sub.paddleSubscriptionId!);
        assert.equal(sitePlanChanges, before); // preflight is read-only
        await commitPlanChange('site-customer', quote.operationId);
        await reconcilePaddleSubscription(sub.paddleSubscriptionId!);
        await syncSiteBilling(); assert.equal(sitePlanChanges, before);
        transactions.set('txn_site_upgrade', { custom_data: transactions.get((await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, secondOrderId) }))!.paddleTransactionId!)!.custom_data, id: 'txn_site_upgrade', subscription_id: current.id, status: 'completed', customer_id: current.customer_id, currency_code: 'USD', created_at: '2098-01-01T00:00:00Z', updated_at: '2098-01-01T00:00:00Z', items: current.items, details: { totals: { grand_total: '1500', discount: '0', balance: '0' } } });
        assert.equal(await event('evt-site-upgrade-paid', 'transaction.completed', 'txn_site_upgrade'), true);
        await syncSiteBilling(); await syncSiteBilling();
        assert.equal(sitePlanChanges, before + 1);
        assert.equal((await db.query.subscription.findFirst({ where: eq(schema.subscription.id, sub.id) }))?.appliedPlanId, 'pro');
        const first = (await db.query.subscription.findFirst({ where: eq(schema.subscription.siteOrderId, siteOrderId) }))!;
        assert.equal(first.planId, 'basic'); assert.equal(siteFixtures.get(first.siteId!)?.plan_id, 'basic');
        await assert.rejects(previewPlanChange('site-customer', 'pro', false), /Choose the site/);
    });
    await check('overdue grace, cancellation and recovery affect only billing-owned site suspensions', async () => {
        const sub = (await db.query.subscription.findFirst({ where: eq(schema.subscription.siteOrderId, secondOrderId) }))!;
        const before = siteDeactivations;
        await db.update(schema.subscription).set({ status: 'PAST_DUE', graceEndsAt: new Date(Date.now() + 86400_000) }).where(eq(schema.subscription.id, sub.id));
        await syncSiteBilling(); assert.equal(siteDeactivations, before);
        await db.update(schema.subscription).set({ graceEndsAt: new Date(0) }).where(eq(schema.subscription.id, sub.id));
        await syncSiteBilling(); await syncSiteBilling(); assert.equal(siteDeactivations, before + 1);
        await assert.rejects(assertSiteBillingAccess('site-customer', sub.siteId!), /Resolve/);
        await db.update(schema.subscription).set({ status: 'ACTIVE', graceEndsAt: null }).where(eq(schema.subscription.id, sub.id));
        await syncSiteBilling(); await syncSiteBilling(); assert.equal(siteReactivations, 1);
        await db.update(schema.subscription).set({ status: 'CANCELED' }).where(eq(schema.subscription.id, sub.id));
        await syncSiteBilling(); assert.equal(siteDeactivations, before + 2);
        await db.update(schema.subscription).set({ status: 'ACTIVE' }).where(eq(schema.subscription.id, sub.id));
        await syncSiteBilling(); await syncSiteBilling();
        siteFixtures.get(sub.siteId!)!.status = 'deactivated'; // manual suspension
        const resumes = siteReactivations; await syncSiteBilling(); assert.equal(siteReactivations, resumes);
        siteFixtures.get(sub.siteId!)!.status = 'ready';
    });
    await check('abandoned setup cleanup cancels unpaid transactions and releases reserved site names', async () => {
        const order = await saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'abandoned-site' });
        const checkout = await startSiteOrderPayment('site-customer', order.id, false); assert.ok(checkout.transactionId);
        await assert.rejects(cancelSiteOrder('customer', order.id), /not found/);
        await db.update(schema.siteOrder).set({ createdAt: new Date(0) }).where(eq(schema.siteOrder.id, order.id));
        await expireSiteOrders();
        const ended = (await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) }))!;
        assert.equal(ended.status, 'EXPIRED'); assert.equal(ended.encryptedSetup, null);
        assert.equal(transactions.get(checkout.transactionId)!.status, 'canceled');
        await saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'abandoned-site' });
        await assert.rejects(cancelSiteOrder('site-customer', siteOrderId), /Paid or provisioning/);
    });
    await check('uncertain or completed abandoned payments retain their site reservation', async () => {
        const order = await saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'uncertain-site' });
        const checkout = await startSiteOrderPayment('site-customer', order.id, false); assert.ok(checkout.transactionId);
        transactions.get(checkout.transactionId)!.status = 'completed';
        await db.update(schema.siteOrder).set({ createdAt: new Date(0) }).where(eq(schema.siteOrder.id, order.id));
        await expireSiteOrders();
        assert.equal((await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) }))?.status, 'AWAITING_PAYMENT');
        await assert.rejects(saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'uncertain-site' }));
        transactions.get(checkout.transactionId)!.status = 'draft'; await cancelSiteOrder('site-customer', order.id);
    });
    await check('billing monitoring requires authentication and detects a missing or stale worker', async () => {
        process.env.BILLING_WORKER_SECRET = 'test-worker-secret';
        assert.equal((await billingHealth(new Request('http://localhost/api/internal/billing'))).status, 401);
        assert.equal((await runWorkerRoute(new Request('http://localhost/api/internal/billing', { method: 'POST' }))).status, 401);
        const request = () => new Request('http://localhost/api/internal/billing', { headers: { Authorization: 'Bearer test-worker-secret' } });
        assert.equal((await billingHealth(request())).status, 503);
        await db.insert(schema.billingProviderRecord).values({ id: 'billing:worker', kind: 'WORKER', payload: { finishedAt: new Date().toISOString(), reconciledAt: new Date().toISOString() }, providerUpdatedAt: new Date() });
        assert.equal((await billingHealth(request())).status, 200);
        await db.update(schema.billingProviderRecord).set({ payload: { finishedAt: new Date(0).toISOString() } }).where(eq(schema.billingProviderRecord.id, 'billing:worker'));
        assert.equal((await billingHealth(request())).status, 503);
    });
    await check('explicit free trial plans provision without creating a payment transaction', async () => {
        await db.insert(schema.plan).values({ id: 'trial-plan', productId: 'product', name: 'Trial', slug: 'trial-plan', priceAmount: null, trialDays: 7 });
        const order = await saveSiteOrder('site-customer', randomUUID(), { ...setupValues, slug: 'trial-site', planId: 'trial-plan' });
        const before = transactionCreates;
        await startSiteOrderPayment('site-customer', order.id, true);
        await provisionSiteOrder(order.id);
        assert.equal(transactionCreates, before);
        assert.equal((await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) }))?.status, 'PROVISIONED');
    });
    await check('rejected checkout setup exposes a safe reference and records provider failure', async () => {
        await creditCustomer('checkout-rejected', 100);
        rejectCheckout = true;
        try { await assert.rejects(createPlanCheckout('checkout-rejected', 'basic', false), (error: unknown) => error instanceof CheckoutError && !!error.reference && /Paddle could not accept/.test(error.message)); }
        finally { rejectCheckout = false; }
        const operation = await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.userId, 'checkout-rejected') });
        assert.equal(operation?.status, 'FAILED');
        assert.equal(await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, 'checkout:checkout-rejected:product') }), undefined);
    });
    await check('an uncertain checkout never invites or creates another payment', async () => {
        await creditCustomer('checkout-uncertain', 100);
        timeoutCheckout = true;
        try { await assert.rejects(createPlanCheckout('checkout-uncertain', 'basic', false), (error: unknown) => error instanceof CheckoutError && !!error.reference && /before submitting another payment/.test(error.message)); }
        finally { timeoutCheckout = false; }
        const before = transactionCreates;
        await assert.rejects(createPlanCheckout('checkout-uncertain', 'basic', false), (error: unknown) => error instanceof CheckoutError && /previous checkout is being checked/.test(error.message));
        assert.equal(transactionCreates, before);
        assert.equal((await db.query.billingOperation.findFirst({ where: eq(schema.billingOperation.userId, 'checkout-uncertain') }))?.status, 'UNKNOWN');
    });
    console.log(`\n${passed} integration checks passed; migrations applied successfully.`);
} finally {
    globalThis.fetch = realFetch;
    await closeDb();
    await adminPool.query(`DROP DATABASE "${databaseName}"`);
    await adminPool.end();
}
