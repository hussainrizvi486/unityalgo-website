import 'server-only';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller, ControllerError } from '@/lib/controller-client';

type Subscription = typeof schema.subscription.$inferSelect;

/** True only when the hosting controller says the site no longer exists. Any other failure counts as "still there". */
async function siteIsGone(siteId: string, userId: string) {
    try {
        await controller.sites.get(siteId, userId);
        return false;
    } catch (error) {
        return error instanceof ControllerError && error.status === 404;
    }
}

/**
 * An older, product-level subscription has no site recorded, but it may still be paying for a site that predates
 * per-site billing. If the customer has such a site on the same plan, or hosting cannot say, treat it as in use.
 */
async function coversUnlinkedSite(subscription: Subscription) {
    try {
        const [sites, linked] = await Promise.all([
            controller.sites.list(subscription.userId),
            db.select({ siteId: schema.subscription.siteId }).from(schema.subscription).where(eq(schema.subscription.userId, subscription.userId)),
        ]);
        const linkedIds = new Set(linked.map((row) => row.siteId).filter(Boolean));
        return sites.results.some((site) => site.plan_id === subscription.planId && !linkedIds.has(site.id));
    } catch {
        return true;
    }
}

/**
 * Is this paid subscription free to run another site?
 * - never attached, or released after its site was deleted, and its original order finished provisioning;
 * - or still pointing at a site the controller no longer has.
 * A subscription whose order is still waiting for payment or provisioning is never idle.
 */
async function isIdle(subscription: Subscription) {
    if (subscription.status !== 'ACTIVE' || !subscription.paddleSubscriptionId || subscription.billingSuspended) return false;
    // A subscription set to end would switch the new site off at the end of the period: never hand it out.
    if (subscription.cancelAtPeriodEnd) return false;
    if (subscription.siteId) return siteIsGone(subscription.siteId, subscription.userId);
    if (!subscription.siteOrderId) return !(await coversUnlinkedSite(subscription));
    const order = await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, subscription.siteOrderId), columns: { status: true } });
    return order?.status === 'PROVISIONED';
}

/** Paid subscriptions that are not running a site, oldest first. Read-only. */
export async function listIdleSubscriptions(userId: string, planId?: string) {
    const candidates = await db.query.subscription.findMany({
        where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.status, 'ACTIVE'), isNotNull(schema.subscription.paddleSubscriptionId), planId ? eq(schema.subscription.planId, planId) : undefined),
        orderBy: asc(schema.subscription.createdAt),
    });
    const idle: Subscription[] = [];
    for (const candidate of candidates) if (await isIdle(candidate)) idle.push(candidate);
    return idle;
}

/**
 * Pay for a new site with a subscription the customer already owns instead of charging again.
 * The order must be waiting for payment. Returns true when a subscription was claimed and the order is READY.
 */
export async function claimIdleSubscription(userId: string, order: { id: string; planId: string }) {
    for (const candidate of await listIdleSubscriptions(userId, order.planId)) {
        const claimed = await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`claim:${userId}:${order.planId}`}, 0))`);
            const [moved] = await tx.update(schema.subscription)
                .set({ siteOrderId: order.id, siteId: null, appliedPlanId: null, appliedAt: null, billingSuspended: false })
                .where(and(
                    eq(schema.subscription.id, candidate.id),
                    candidate.siteId ? eq(schema.subscription.siteId, candidate.siteId) : isNull(schema.subscription.siteId),
                    candidate.siteOrderId ? eq(schema.subscription.siteOrderId, candidate.siteOrderId) : isNull(schema.subscription.siteOrderId),
                )).returning({ id: schema.subscription.id });
            if (!moved) return false;
            const [ready] = await tx.update(schema.siteOrder)
                .set({ status: 'READY', paidAt: new Date(), error: null, updatedAt: new Date() })
                .where(and(eq(schema.siteOrder.id, order.id), eq(schema.siteOrder.userId, userId), eq(schema.siteOrder.status, 'AWAITING_PAYMENT'), isNull(schema.siteOrder.paidAt)))
                .returning({ id: schema.siteOrder.id });
            // The order moved on (paid, canceled): undo the claim rather than strand the subscription.
            if (!ready) throw new Error('ORDER_NOT_CLAIMABLE');
            return true;
        }).catch((error) => { if (error instanceof Error && error.message === 'ORDER_NOT_CLAIMABLE') return false; throw error; });
        if (claimed) return true;
    }
    return false;
}
