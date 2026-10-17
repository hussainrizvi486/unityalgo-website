/**
 * Paid-app billing against the real database, with Paddle replaced by an in-memory fake: what is charged, when,
 * and that a failed install never leaves a charge behind.
 *
 *   npm run test:billing
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { closeDb, db, schema } from '../lib/db';
import { appBillingMode, billingSubscription, cancelPurchase, isPaidApp, purchaseApp, reconcilePurchases, BillingError } from '../lib/app-billing';

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
    try { await fn(); console.log('ok  ', name); }
    catch (error) { failures++; console.log('FAIL', name, '\n     ', (error as Error).message.split('\n').slice(0, 6).join('\n      ')); }
}

// --- a fake Paddle: one subscription, items kept in memory, every call recorded ---------------------------------
const paddle = {
    status: 'active',
    items: [{ price: { id: 'pri_plan' }, quantity: 1 }] as Array<{ price: { id: string }; quantity: number }>,
    patches: [] as unknown[],
    failPatch: false,
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { data } : { error: { detail: String(data) } }), { status });
    if (!url.includes('/subscriptions/')) return realFetch(input, init);
    if ((init?.method ?? 'GET') === 'GET') return reply({ status: paddle.status, items: paddle.items });
    if (paddle.failPatch) return reply('The card was declined.', 400);
    const body = JSON.parse(String(init?.body));
    paddle.patches.push(body);
    paddle.items = body.items.map((item: { price_id: string; quantity: number }) => ({ price: { id: item.price_id }, quantity: item.quantity }));
    return reply({ status: paddle.status, items: paddle.items });
}) as typeof fetch;

process.env.PADDLE_API_KEY = 'test_key';
delete process.env.APP_BILLING_MODE;

// --- fixtures ----------------------------------------------------------------------------------------------------
const user = await db.query.user.findFirst({ where: eq(schema.user.role, 'CUSTOMER'), columns: { id: true } });
const plan = await db.query.plan.findFirst({ columns: { id: true, productId: true } });
assert.ok(user && plan, 'the development database needs a customer and a plan');
const stamp = Date.now().toString(36);
const subscriptionId = `sub_test_${stamp}`;
const [subscription] = await db.insert(schema.subscription).values({
    userId: user.id, planId: plan.id, productId: `${plan.productId}`, status: 'ACTIVE', paddleSubscriptionId: subscriptionId,
}).onConflictDoNothing().returning();
const reuse = subscription ?? null;
const [app] = await db.insert(schema.appCatalog).values({
    slug: `billing-test-${stamp}`, name: 'Billing test', description: 'x', category: 'Test', frappeAppName: `billing_test_${stamp}`,
    priceAmount: 5, paddlePriceId: 'pri_app', isActive: true,
}).returning();
const [free] = await db.insert(schema.appCatalog).values({ slug: `billing-free-${stamp}`, name: 'Free', description: 'x', category: 'Test' }).returning();
const created: string[] = [];

async function purchase(siteId: string) {
    const record = await purchaseApp({ userId: user!.id, app, siteId });
    created.push(record.id);
    return record;
}

try {
    if (!reuse) {
        console.log('SKIP the customer already has a subscription for this product; the Paddle-backed checks need a clean one.');
    } else {
        await check('a paid app is a priced item on the customer\'s subscription', async () => {
            assert.equal(isPaidApp(app), true);
            assert.equal(isPaidApp(free), false);
            assert.equal(appBillingMode(), 'paddle');
            assert.equal((await billingSubscription(user.id, plan.id))?.paddleSubscriptionId, subscriptionId);
        });

        await check('buying it adds one item at quantity 1, charged immediately and prorated, leaving the plan item alone', async () => {
            const record = await purchase('site-a');
            assert.deepEqual([record.billingMode, record.status], ['paddle', 'ACTIVE']);
            assert.deepEqual(paddle.items.map((item) => [item.price.id, item.quantity]), [['pri_plan', 1], ['pri_app', 1]]);
            assert.equal((paddle.patches.at(-1) as { proration_billing_mode: string }).proration_billing_mode, 'prorated_immediately');
        });

        await check('buying again for the same site never charges twice', async () => {
            const before = paddle.patches.length;
            await purchase('site-a');
            assert.equal(paddle.patches.length, before);
        });

        await check('a second site raises the quantity, and the price is per site', async () => {
            await purchase('site-b');
            assert.equal(paddle.items.find((item) => item.price.id === 'pri_app')?.quantity, 2);
        });

        await check('cancelling one lowers the quantity; cancelling the last removes the item', async () => {
            const rows = await db.query.appPurchase.findMany({ where: eq(schema.appPurchase.appId, app.id) });
            await cancelPurchase(rows.find((row) => row.siteId === 'site-b')!);
            assert.equal(paddle.items.find((item) => item.price.id === 'pri_app')?.quantity, 1);
            await cancelPurchase(rows.find((row) => row.siteId === 'site-a')!);
            assert.deepEqual(paddle.items.map((item) => item.price.id), ['pri_plan']);
            await cancelPurchase(rows.find((row) => row.siteId === 'site-a')!);     // twice is harmless
            assert.deepEqual(paddle.items.map((item) => item.price.id), ['pri_plan']);
        });

        await check('billing stops for an app that never reached its site, but not for one that did, one still installing, or a site out of view', async () => {
            const old = new Date(Date.now() - 60 * 60_000);
            const ids = { missing: 'rec-missing', has: 'rec-has', busy: 'rec-busy', fresh: 'rec-fresh', elsewhere: 'rec-elsewhere' };
            for (const siteId of Object.values(ids)) await purchase(siteId);
            await db.update(schema.appPurchase).set({ createdAt: old }).where(inArray(schema.appPurchase.siteId, [ids.missing, ids.has, ids.busy, ids.elsewhere]));
            const sites = [
                { id: ids.missing, apps: ['erpnext'], status: 'ready', activity: null },
                { id: ids.has, apps: ['erpnext', app.frappeAppName!], status: 'ready', activity: null },
                { id: ids.busy, apps: ['erpnext'], status: 'updating', activity: null },
                { id: ids.fresh, apps: ['erpnext'], status: 'ready', activity: null },
            ];
            const status = async (siteId: string) => (await db.query.appPurchase.findFirst({ where: eq(schema.appPurchase.siteId, siteId) }))!.status;
            assert.equal(await reconcilePurchases(user.id, sites), 1);
            assert.deepEqual(await Promise.all(Object.values(ids).map(status)), ['CANCELED', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE']);
            // With the full list, a purchase for a site that no longer exists is released too.
            assert.equal(await reconcilePurchases(user.id, sites, true), 1);
            assert.equal(await status(ids.elsewhere), 'CANCELED');
            for (const siteId of [ids.has, ids.busy, ids.fresh]) await cancelPurchase((await db.query.appPurchase.findFirst({ where: eq(schema.appPurchase.siteId, siteId) }))!);
        });

        await check('a declined charge installs nothing and records nothing', async () => {
            paddle.failPatch = true;
            await assert.rejects(purchase('site-c'), (error: Error) => error instanceof BillingError && /declined/.test(error.message));
            paddle.failPatch = false;
            const rows = await db.query.appPurchase.findMany({ where: eq(schema.appPurchase.siteId, 'site-c') });
            assert.equal(rows.length, 0);
        });

        await check('an inactive subscription cannot take new apps', async () => {
            paddle.status = 'past_due';
            await assert.rejects(purchase('site-d'), /not active/);
            paddle.status = 'active';
        });

        await check('an app with no Paddle price cannot be sold', async () => {
            const [unpriced] = await db.insert(schema.appCatalog).values({ slug: `billing-nopr-${stamp}`, name: 'No price', description: 'x', category: 'Test', priceAmount: 3 }).returning();
            try {
                await assert.rejects(purchaseApp({ userId: user.id, app: unpriced, siteId: 'site-e' }), /not been set up for billing/);
            } finally {
                await db.delete(schema.appCatalog).where(eq(schema.appCatalog.id, unpriced.id));
            }
        });

        await check('a free app is never billed', async () => {
            await assert.rejects(purchaseApp({ userId: user.id, app: free, siteId: 'site-f' }), /free/);
        });

        await check('without a subscription there is nothing to bill to', async () => {
            await db.update(schema.subscription).set({ status: 'CANCELED' }).where(eq(schema.subscription.id, reuse.id));
            await assert.rejects(purchase('site-g'), /Subscribe to a plan/);
            await db.update(schema.subscription).set({ status: 'ACTIVE' }).where(eq(schema.subscription.id, reuse.id));
        });
    }

    await check('test billing records without charging, and is refused in production', async () => {
        process.env.APP_BILLING_MODE = 'test';
        const before = paddle.patches.length;
        const record = await purchase('site-h');
        assert.equal(record.billingMode, 'test');
        assert.equal(paddle.patches.length, before);
        await cancelPurchase(record);
        assert.equal(paddle.patches.length, before);
        (process.env as Record<string, string>).NODE_ENV = 'production';
        assert.equal(appBillingMode(), null);
        (process.env as Record<string, string>).NODE_ENV = 'test';
        delete process.env.APP_BILLING_MODE;
    });

    await check('with no billing configured paid apps cannot be bought', async () => {
        delete process.env.PADDLE_API_KEY;
        assert.equal(appBillingMode(), null);
        await assert.rejects(purchase('site-i'), /billing is not available/);
        process.env.PADDLE_API_KEY = 'test_key';
    });
} finally {
    if (created.length) await db.delete(schema.appPurchase).where(inArray(schema.appPurchase.id, created));
    await db.delete(schema.appPurchase).where(eq(schema.appPurchase.appId, app.id));
    await db.delete(schema.appCatalog).where(inArray(schema.appCatalog.id, [app.id, free.id]));
    if (reuse) await db.delete(schema.subscription).where(eq(schema.subscription.id, reuse.id));
    await closeDb();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
