/** Opt-in real sandbox lifecycle fixture. Never accepts live Paddle credentials. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db, schema, closeDb } from '../lib/db';
import { paddleRequest } from '../lib/paddle-catalog';
import { asRecord, asString } from '../lib/paddle-data';
import { saveSiteOrder } from '../lib/site-orders';
import { reconcilePaddleSubscription, reconcilePaddleTransaction } from '../lib/paddle-sync';
import { syncSiteBilling } from '../lib/site-billing-lifecycle';
import { previewPlanChange, commitPlanChange } from '../lib/subscription-billing';
import { controller, ControllerError } from '../lib/controller-client';
if (process.env.NEXT_PUBLIC_PADDLE_ENV !== 'sandbox' || !process.env.PADDLE_API_KEY?.includes('sdbx')) throw new Error('Explicit sandbox configuration is required.');
const file = '/tmp/unityalgo-site-billing-sandbox.json';
const command = process.argv[2] ?? 'status';
try {
    if (command === 'setup') {
        try { const existing = JSON.parse(await readFile(file, 'utf8')); if (!existing.cleanedAt) throw new Error('A test fixture already exists. Inspect or clean it up first.'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        const stamp = randomUUID().slice(0, 8);
        const product = await db.query.product.findFirst({ where: eq(schema.product.slug, 'algosuite') });
        if (!product) throw new Error('AlgoSuite catalog is missing.');
        const providerProduct = asRecord(await paddleRequest('/products', { method: 'POST', body: JSON.stringify({ name: `Site lifecycle test ${stamp}`, tax_category: 'standard' }) }));
        const fixture = { stamp, userId: `site-e2e-${stamp}`, email: `site-e2e-${stamp}@example.com`, password: `Sandbox-test-${stamp}-Only!`, slug: `billing-test-${stamp}`, providerProductId: asString(providerProduct.id)!, prices: [] as string[], plans: [] as string[], orderId: '' };
        await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
        for (const [index, amount] of ['100', '200'].entries()) {
            const price = asRecord(await paddleRequest('/prices', { method: 'POST', body: JSON.stringify({ product_id: providerProduct.id, description: `Site lifecycle test ${stamp} ${index}`, unit_price: { amount, currency_code: 'USD' }, billing_cycle: { interval: 'month', frequency: 1 }, tax_mode: 'external', quantity: { minimum: 1, maximum: 1 } }) }));
            fixture.prices.push(asString(price.id)!);
            const [plan] = await db.insert(schema.plan).values({ productId: product.id, name: `Sandbox lifecycle ${index ? 'Growth' : 'Basic'} ${stamp}`, slug: `sandbox-lifecycle-${stamp}-${index}`, priceAmount: Number(amount) / 100, paddlePriceId: asString(price.id), vcpu: index ? 2 : 1, ramMb: index ? 4096 : 2048, storageGb: index ? 20 : 10, userLimit: index ? 10 : 5 }).returning();
            fixture.plans.push(plan.id);
            await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
        }
        await db.insert(schema.user).values({ id: fixture.userId, email: fixture.email, passwordHash: await bcrypt.hash(fixture.password, 10), name: 'Sandbox Site Lifecycle Test', role: 'CUSTOMER' });
        const order = await saveSiteOrder(fixture.userId, randomUUID(), { slug: fixture.slug, companyName: 'Sandbox Billing Test', country: 'United States', currency: 'USD', coaType: 'standard', planId: fixture.plans[0], apps: [], email: fixture.email, password: fixture.password, confirmPassword: fixture.password });
        fixture.orderId = order.id;
        await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
        console.log({ email: fixture.email, password: fixture.password, paymentPage: `http://localhost:3000/dashboard/sites/orders/${order.id}`, upgradePlanId: fixture.plans[1] });
    } else {
        const fixture = JSON.parse(await readFile(file, 'utf8'));
        const order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, fixture.orderId), eq(schema.siteOrder.userId, fixture.userId)) });
        const sub = await db.query.subscription.findFirst({ where: eq(schema.subscription.siteOrderId, fixture.orderId) });
        if (command === 'upgrade') {
            if (!sub?.siteId || !sub.paddleSubscriptionId) throw new Error('Wait for paid provisioning first.');
            const quote = await previewPlanChange(fixture.userId, fixture.plans[1], false, sub.paddleSubscriptionId);
            console.log({ preview: quote.preview });
            await commitPlanChange(fixture.userId, quote.operationId);
            await reconcilePaddleSubscription(sub.paddleSubscriptionId);
            await syncSiteBilling();
        } else if (command === 'cancel') {
            if (!sub?.paddleSubscriptionId) throw new Error('No test subscription exists.');
            const provider = asRecord(await paddleRequest(`/subscriptions/${sub.paddleSubscriptionId}`));
            if (provider.status !== 'canceled') await paddleRequest(`/subscriptions/${sub.paddleSubscriptionId}/cancel`, { method: 'POST', body: JSON.stringify({ effective_from: 'immediately' }) });
            await reconcilePaddleSubscription(sub.paddleSubscriptionId);
            console.log(await syncSiteBilling(1, sub.id));
        } else if (command === 'cleanup') {
            if (sub?.paddleSubscriptionId) {
                const provider = asRecord(await paddleRequest(`/subscriptions/${sub.paddleSubscriptionId}`));
                if (provider.status !== 'canceled') await paddleRequest(`/subscriptions/${sub.paddleSubscriptionId}/cancel`, { method: 'POST', body: JSON.stringify({ effective_from: 'immediately' }) });
                await reconcilePaddleSubscription(sub.paddleSubscriptionId);
            } else if (order?.paddleTransactionId) {
                const transaction = asRecord(await paddleRequest(`/transactions/${order.paddleTransactionId}`));
                if (['draft', 'ready'].includes(String(transaction.status))) await paddleRequest(`/transactions/${order.paddleTransactionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled' }) });
            }
            if (order?.siteId) {
                try {
                    const site = await controller.sites.get(order.siteId, fixture.userId);
                    if (['ready', 'stopped', 'deactivated', 'failed'].includes(site.status)) await controller.sites.remove(site.id, fixture.userId, fixture.slug);
                } catch (error) { if (!(error instanceof ControllerError && error.status === 404)) throw error; }
            }
            for (const id of fixture.plans) await db.update(schema.plan).set({ isActive: false }).where(eq(schema.plan.id, id));
            for (const id of fixture.prices) await paddleRequest(`/prices/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
            await paddleRequest(`/products/${fixture.providerProductId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
            await writeFile(file, JSON.stringify({ ...fixture, cleanedAt: new Date().toISOString() }), { mode: 0o600 });
            console.log('Test subscription canceled and catalog archived. Audit records retained; any created site is queued for removal.');
        } else if (command === 'status') {
            if (order?.paddleTransactionId && order.status === 'AWAITING_PAYMENT') await reconcilePaddleTransaction(order.paddleTransactionId);
            if (sub?.paddleSubscriptionId) await reconcilePaddleSubscription(sub.paddleSubscriptionId);
            await syncSiteBilling();
            console.log({ order: order?.status, siteId: order?.siteId, subscriptionId: sub?.paddleSubscriptionId, planId: sub?.planId, appliedPlanId: sub?.appliedPlanId });
            if (order?.siteId) {
                try { const site = await controller.sites.get(order.siteId, fixture.userId); console.log({ hostingStatus: site.status, planId: site.plan_id, resources: site.resources, error: site.error }); }
                catch (error) { if (error instanceof ControllerError && error.status === 404) console.log({ hostingStatus: 'removed' }); else throw error; }
            }
        } else throw new Error('Use setup, status, upgrade, cancel or cleanup.');
    }
} finally { await closeDb(); }
