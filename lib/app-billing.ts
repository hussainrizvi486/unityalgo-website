import 'server-only';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { assertNoPendingSubscriptionCredits } from '@/lib/credit-billing';
import { paddleRequest } from '@/lib/paddle-catalog';

export type BillingMode = 'paddle' | 'test';

export class BillingError extends Error {}
type BillingDb = Pick<typeof db, 'query' | 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

type App = typeof schema.appCatalog.$inferSelect;
export type AppPurchase = typeof schema.appPurchase.$inferSelect;

export const isPaidApp = (app: Pick<App, 'priceAmount'>) => (app.priceAmount ?? 0) > 0;

export function appBillingMode(): BillingMode | null {
    if (process.env.APP_BILLING_MODE === 'test') return process.env.NODE_ENV === 'production' ? null : 'test';
    return process.env.PADDLE_API_KEY ? 'paddle' : null;
}

export async function billingSubscription(userId: string, planId?: string | null, client: BillingDb = db, siteId?: string) {
    const subscriptions = await client.query.subscription.findMany({
        where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.status, 'ACTIVE'), siteId ? eq(schema.subscription.siteId, siteId) : undefined),
    });
    const paddle = subscriptions.filter((subscription) => subscription.paddleSubscriptionId);
    if (paddle.length > 1) throw new BillingError('Choose the site subscription before purchasing apps.');
    return paddle.find((subscription) => subscription.planId === planId) ?? paddle[0] ?? null;
}

interface PaddleSubscription {
    status: string;
    items: Array<{ price: { id: string }; quantity: number }>;
}

async function setQuantity(paddleSubscriptionId: string, priceId: string, quantity: number, client: BillingDb) {
    await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${paddleSubscriptionId}`}, 0))`);
    await assertNoPendingSubscriptionCredits(client, paddleSubscriptionId);
    const pending = await client.query.billingOperation.findFirst({ where: and(
        eq(schema.billingOperation.subscriptionId, paddleSubscriptionId), inArray(schema.billingOperation.status, ['PROCESSING', 'UNKNOWN']),
    ) });
    if (pending) throw new BillingError('A subscription change is being checked. Please try again later.');
    return setQuantityUnlocked(paddleSubscriptionId, priceId, quantity);
}

async function setQuantityUnlocked(paddleSubscriptionId: string, priceId: string, quantity: number) {
    let current: PaddleSubscription;
    try {
        current = (await paddleRequest(`/subscriptions/${paddleSubscriptionId}`)) as PaddleSubscription;
    } catch (error) {
        throw new BillingError(`Your subscription could not be read: ${(error as Error).message}`);
    }
    if (current.status !== 'active') throw new BillingError('Your subscription is not active, so apps cannot be added to it.');
    const items = current.items.filter((item) => item.price.id !== priceId).map((item) => ({ price_id: item.price.id, quantity: item.quantity }));
    if (quantity > 0) items.push({ price_id: priceId, quantity });
    try {
        await paddleRequest(`/subscriptions/${paddleSubscriptionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ items, proration_billing_mode: 'prorated_immediately', on_payment_failure: 'prevent_change' }),
        });
    } catch (error) {
        throw new BillingError(`Paddle did not accept the change: ${(error as Error).message}`);
    }
}

async function activeCount(userId: string, appId: string, paddleSubscriptionId: string | null, client: BillingDb) {
    const rows = await client
        .select({ n: count() })
        .from(schema.appPurchase)
        .where(and(
            eq(schema.appPurchase.userId, userId),
            eq(schema.appPurchase.appId, appId),
            eq(schema.appPurchase.status, 'ACTIVE'),
            eq(schema.appPurchase.billingMode, 'paddle'),
            paddleSubscriptionId ? eq(schema.appPurchase.paddleSubscriptionId, paddleSubscriptionId) : undefined,
        ));
    return rows[0]?.n ?? 0;
}

async function purchaseAppUnlocked(input: { userId: string; app: App; siteId: string; planId?: string | null }, client: BillingDb): Promise<AppPurchase> {
    const { userId, app, siteId } = input;
    if (!isPaidApp(app)) throw new BillingError('This application is free.');
    const mode = appBillingMode();
    if (!mode) throw new BillingError('Paid apps cannot be installed right now because billing is not available. Please try again later or contact support.');

    const existing = await client.query.appPurchase.findFirst({
        where: and(eq(schema.appPurchase.siteId, siteId), eq(schema.appPurchase.appId, app.id), eq(schema.appPurchase.status, 'ACTIVE')),
    });
    if (existing) return existing;      // already bought for this site: never charge twice

    let paddleSubscriptionId: string | null = null;
    if (mode === 'paddle') {
        const subscription = await billingSubscription(userId, input.planId, client, siteId);
        if (!subscription?.paddleSubscriptionId) throw new BillingError('Subscribe to a plan before adding paid apps, so there is a subscription to bill them to.');
        if (!app.paddlePriceId) throw new BillingError('This application has not been set up for billing yet. Please contact support.');
        paddleSubscriptionId = subscription.paddleSubscriptionId;
        const quantity = (await activeCount(userId, app.id, paddleSubscriptionId, client)) + 1;
        await setQuantity(paddleSubscriptionId, app.paddlePriceId, quantity, client);
    }
    try {
        const [created] = await client.insert(schema.appPurchase).values({
            userId, appId: app.id, siteId, priceAmount: app.priceAmount!, currency: app.priceCurrency, billingMode: mode, paddleSubscriptionId,
        }).returning();
        return created;
    } catch (error) {
        if (mode === 'paddle' && paddleSubscriptionId && app.paddlePriceId) {
            await setQuantity(paddleSubscriptionId, app.paddlePriceId, await activeCount(userId, app.id, paddleSubscriptionId, client), client).catch(() => undefined);
        }
        throw error;
    }
}

async function cancelPurchaseUnlocked(purchase: AppPurchase, client: BillingDb): Promise<void> {
    const claimed = await client.update(schema.appPurchase)
        .set({ status: 'CANCELED', canceledAt: new Date() })
        .where(and(eq(schema.appPurchase.id, purchase.id), eq(schema.appPurchase.status, 'ACTIVE')))
        .returning({ id: schema.appPurchase.id });
    if (!claimed.length) return;       // already cancelled by something else
    if (purchase.billingMode !== 'paddle' || !purchase.paddleSubscriptionId) return;
    const app = await client.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, purchase.appId), columns: { paddlePriceId: true } });
    if (!app?.paddlePriceId) return;
    try {
        await setQuantity(purchase.paddleSubscriptionId, app.paddlePriceId, await activeCount(purchase.userId, purchase.appId, purchase.paddleSubscriptionId, client), client);
    } catch (error) {
        await client.update(schema.appPurchase).set({ status: 'ACTIVE', canceledAt: null }).where(eq(schema.appPurchase.id, purchase.id));
        throw error;
    }
}

// Serialize app counts and ownership checks as well as provider item mutations.
// Reject competing requests promptly rather than exhausting database connections waiting on locks.
async function withAppMutation<T>(userId: string, action: (client: BillingDb) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
        const result = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${`app-billing:${userId}`}, 0)) as locked`);
        if (!result.rows[0]?.locked) throw new BillingError('Another app billing change is in progress. Please try again.');
        return action(tx);
    });
}
export async function purchaseApp(input: { userId: string; app: App; siteId: string; planId?: string | null }): Promise<AppPurchase> {
    return withAppMutation(input.userId, (tx) => purchaseAppUnlocked(input, tx));
}
export async function cancelPurchase(purchase: AppPurchase): Promise<void> {
    return withAppMutation(purchase.userId, (tx) => cancelPurchaseUnlocked(purchase, tx));
}

export async function activePurchase(siteId: string, appId: string) {
    return db.query.appPurchase.findFirst({
        where: and(eq(schema.appPurchase.siteId, siteId), eq(schema.appPurchase.appId, appId), eq(schema.appPurchase.status, 'ACTIVE')),
    });
}

const SETTLE_MS = 30 * 60_000;

export async function reconcilePurchases(
    userId: string,
    sites: Array<{ id: string; apps: string[]; status: string; activity: string | null }>,
    complete = false,
) {
    const purchases = await db.query.appPurchase.findMany({
        where: and(eq(schema.appPurchase.userId, userId), eq(schema.appPurchase.status, 'ACTIVE')),
    });
    if (!purchases.length) return 0;
    const catalogue = await db.query.appCatalog.findMany({ columns: { id: true, frappeAppName: true, appType: true } });
    const frappeName = new Map(catalogue.map((app) => [app.id, app.frappeAppName]));
    // A module entry is not an app on the site: it is installed when the site has its record, not when its name is in the app list.
    const moduleIds = new Set(catalogue.filter((app) => app.appType === 'module').map((app) => app.id));
    const moduleRows = new Set((await db.select({ siteId: schema.siteModuleApp.siteId, appId: schema.siteModuleApp.appId }).from(schema.siteModuleApp)
        .where(inArray(schema.siteModuleApp.siteId, [...new Set(purchases.map((purchase) => purchase.siteId))]))).map((row) => `${row.siteId}:${row.appId}`));
    const bySite = new Map(sites.map((site) => [site.id, site]));
    let cancelled = 0;
    for (const purchase of purchases) {
        if (Date.now() - purchase.createdAt.getTime() < SETTLE_MS) continue;
        const site = bySite.get(purchase.siteId);
        if (!site && !complete) continue;       // not looking at that site right now
        if (site && (site.status === 'updating' || site.activity)) continue;
        const name = frappeName.get(purchase.appId);
        const installed = moduleIds.has(purchase.appId) ? Boolean(site) && moduleRows.has(`${purchase.siteId}:${purchase.appId}`) : Boolean(site && name && site.apps.includes(name));
        if (installed) continue;
        try {
            await cancelPurchase(purchase);
            cancelled++;
        } catch {
            // Billing is unreachable now; the next page load tries again.
        }
    }
    return cancelled;
}
