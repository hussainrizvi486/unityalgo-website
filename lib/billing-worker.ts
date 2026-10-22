import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { drainPaddleEvents, drainBillingFulfillments, recoverStalledBillingOperations, reconcileAllPaddleBilling } from '@/lib/paddle-sync';
import { maintainCreditRedemptions } from '@/lib/credit-billing';
import { drainSiteOrders, expireSiteOrders, reconcilePendingSitePayments } from '@/lib/site-orders';
import { syncSiteBilling } from '@/lib/site-billing-lifecycle';
import { asRecord } from '@/lib/paddle-data';

export async function runBillingWorker() {
    const key = 'billing:worker';
    const previous = await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, key) });
    const last = asRecord(previous?.payload);
    const startedAt = new Date().toISOString();
    async function record(payload: Record<string, unknown>) {
        await db.insert(schema.billingProviderRecord).values({ id: key, kind: 'WORKER', payload, providerUpdatedAt: new Date() })
            .onConflictDoUpdate({ target: schema.billingProviderRecord.id, set: { payload, providerUpdatedAt: new Date() } });
    }
    await record({ ...last, startedAt });
    try {
        await recoverStalledBillingOperations();
        // Full reconciliation also recovers missed webhooks. Once daily, not every poll.
        let reconciledAt = last.reconciledAt;
        if (!reconciledAt || Date.now() - new Date(String(reconciledAt)).getTime() > 86400_000) {
            try { await reconcileAllPaddleBilling(); reconciledAt = new Date().toISOString(); }
            catch { /* Keep draining persisted events; monitoring reports reconciliation delay. */ }
        }
        await maintainCreditRedemptions();
        const payments = await reconcilePendingSitePayments(5);
        const events = await drainPaddleEvents(10);
        await maintainCreditRedemptions();
        const result = { payments, events, fulfillment: await drainBillingFulfillments(5), sites: await drainSiteOrders(5), lifecycle: await syncSiteBilling(25), abandoned: await expireSiteOrders(25) };
        await record({ startedAt, finishedAt: new Date().toISOString(), reconciledAt, result, error: null });
        return result;
    } catch {
        await record({ ...last, startedAt, failedAt: new Date().toISOString(), error: 'Billing processing failed; inspect pending events and provider availability.' });
        throw new Error('Billing processing failed.');
    }
}
