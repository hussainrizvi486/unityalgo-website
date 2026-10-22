import 'server-only';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller, ControllerError } from '@/lib/controller-client';
import { asRecord } from '@/lib/paddle-data';

/** Billing owns only suspensions it initiated; manual suspensions stay manual. */
export async function syncSiteBilling(limit = 25, subscriptionId?: string) {
    const rows = await db.query.subscription.findMany({ where: and(isNotNull(schema.subscription.siteId), subscriptionId ? eq(schema.subscription.id, subscriptionId) : undefined), orderBy: schema.subscription.updatedAt, limit });
    let failed = 0;
    for (const row of rows) {
        try {
            await db.transaction(async (tx) => {
                const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${`site-billing:${row.id}`}, 0)) as locked`);
                if (!lock.rows[0]?.locked) return;
                const sub = await tx.query.subscription.findFirst({ where: eq(schema.subscription.id, row.id), with: { plan: true } });
                if (!sub?.siteId) return;
                let site;
                try { site = await controller.sites.get(sub.siteId, sub.userId); }
                catch (error) {
                    if (error instanceof ControllerError && error.status === 404 && sub.status === 'CANCELED') {
                        // The order retains historical site identity after a canceled site's deletion.
                        await tx.update(schema.subscription).set({ siteId: null, billingSuspended: false }).where(eq(schema.subscription.id, sub.id));
                        return;
                    }
                    throw error;
                }
                const suspend = sub.status === 'CANCELED' || sub.status === 'PAUSED' || (sub.status === 'PAST_DUE' && !!sub.graceEndsAt && sub.graceEndsAt <= new Date());
                if (suspend) {
                    if (!site.activity && ['ready', 'stopped'].includes(site.status)) {
                        // Persist intent even if the response is lost after the controller accepts it.
                        await tx.update(schema.subscription).set({ billingSuspended: true }).where(eq(schema.subscription.id, sub.id));
                        try { await controller.sites.action(site.id, sub.userId, 'deactivate'); } catch { failed++; }
                    }
                } else if (sub.status === 'ACTIVE') {
                    if (sub.billingSuspended && site.status === 'deactivated' && !site.activity) {
                        await controller.sites.action(site.id, sub.userId, 'reactivate');
                        return; // Observe the completed restart before clearing ownership.
                    }
                    if (sub.billingSuspended && site.status === 'ready' && !site.activity) await tx.update(schema.subscription).set({ billingSuspended: false }).where(eq(schema.subscription.id, sub.id));
                    if (sub.appliedPlanId !== sub.planId && site.status === 'ready' && !site.activity) {
                        if (site.plan_id === sub.planId) {
                            await tx.update(schema.subscription).set({ appliedPlanId: sub.planId, appliedAt: new Date() }).where(eq(schema.subscription.id, sub.id));
                            return;
                        }
                        // A subscription item change alone never authorizes more resources.
                        const records = await tx.query.billingProviderRecord.findMany({ where: and(eq(schema.billingProviderRecord.subscriptionId, sub.paddleSubscriptionId!), eq(schema.billingProviderRecord.kind, 'TRANSACTION')) });
                        const operations = await tx.query.billingOperation.findMany({ where: and(eq(schema.billingOperation.subscriptionId, sub.paddleSubscriptionId!), eq(schema.billingOperation.planId, sub.planId), inArray(schema.billingOperation.status, ['SUCCEEDED', 'UNKNOWN'])) });
                        const since = Math.max(sub.appliedAt?.getTime() ?? 0, ...operations.map((op) => op.createdAt.getTime()));
                        const paid = records.some((record) => {
                            const payment = asRecord(record.payload);
                            return payment.status === 'completed' && asRecord(asRecord(payment.details).totals).balance === '0'
                                && new Date(String(payment.created_at)).getTime() >= since
                                && Array.isArray(payment.items) && payment.items.some((item) => asRecord(asRecord(item).price).id === sub.plan.paddlePriceId);
                        });
                        if (!paid) return;
                        await controller.sites.changePlan(site.id, sub.userId, {
                            plan_id: sub.plan.id, plan_name: sub.plan.name, plan_vcpu: sub.plan.vcpu,
                            plan_ram_mb: sub.plan.ramMb, plan_storage_gb: sub.plan.storageGb, plan_user_limit: sub.plan.userLimit,
                        });
                        // The next pass observes actual limits, not just queue acceptance.
                    }
                }
            });
        } catch { failed++; }
        // Round-robin across all sites, including sites currently waiting on hosting/payment.
        await db.update(schema.subscription).set({ updatedAt: new Date() }).where(eq(schema.subscription.id, row.id));
    }
    return { attempted: rows.length, failed };
}

export async function assertSiteBillingAccess(userId: string, siteId: string) {
    const sub = await db.query.subscription.findFirst({ where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.siteId, siteId)) });
    if (sub && (sub.status === 'CANCELED' || sub.status === 'PAUSED' || (sub.status === 'PAST_DUE' && sub.graceEndsAt && sub.graceEndsAt <= new Date()))) throw new Error('Resolve this site’s subscription payment before starting it.');
}
