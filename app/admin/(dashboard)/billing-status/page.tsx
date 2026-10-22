import Link from 'next/link';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { asRecord } from '@/lib/paddle-data';
import { Notice } from '@/components/ui/notice';

export default async function BillingStatusPage() {
    await requireAdmin();
    const [worker, pending, failed, uncertain, queued, expiredGrace] = await Promise.all([
        db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, 'billing:worker') }),
        db.$count(schema.paddleEvent, inArray(schema.paddleEvent.status, ['PENDING', 'FAILED'])),
        db.$count(schema.paddleEvent, and(eq(schema.paddleEvent.status, 'FAILED'), sql`${schema.paddleEvent.attempts} >= 20`)),
        db.$count(schema.billingOperation, eq(schema.billingOperation.status, 'UNKNOWN')),
        db.$count(schema.siteOrder, eq(schema.siteOrder.status, 'READY')),
        db.$count(schema.subscription, and(eq(schema.subscription.status, 'PAST_DUE'), sql`${schema.subscription.graceEndsAt} <= timezone('UTC', now())`)),
    ]);
    const clock = await db.execute(sql`select extract(epoch from now()) * 1000 as milliseconds`);
    const now = Number(clock.rows[0].milliseconds);
    const resourceChanges = await db.$count(schema.subscription, sql`${schema.subscription.siteId} is not null and ${schema.subscription.appliedPlanId} is distinct from ${schema.subscription.planId}`);
    const payload = asRecord(worker?.payload);
    const lastSuccess = typeof payload.finishedAt === 'string' ? payload.finishedAt : null;
    const stale = !lastSuccess || now - new Date(lastSuccess).getTime() > 5 * 60_000;
    const failedFulfillment = await db.$count(schema.billingFulfillment, and(isNull(schema.billingFulfillment.processedAt), sql`${schema.billingFulfillment.attempts} >= 20`));
    return <div className="portal-page mx-auto">
        <Link href="/admin/payments" className="text-sm hover:underline">Back to payments</Link>
        <h1 className="portal-page-title mt-6">Billing processing</h1>
        <div className="mt-6 space-y-4">
            {!process.env.PUBLIC_APP_URL && <Notice tone="warning">No public webhook URL is recorded. Local payment verification works, but configure an HTTPS destination before relying on immediate renewal and cancellation updates.</Notice>}
            <Notice tone={stale || payload.error ? 'warning' : 'info'}>{stale ? 'Billing worker is missing or has not completed within five minutes.' : 'Billing worker has completed recently.'} Last completed: {lastSuccess ?? 'Never'}.</Notice>
            {(!payload.reconciledAt || now - new Date(String(payload.reconciledAt)).getTime() > 2 * 86400_000) && <Notice tone="warning">Daily reconciliation is overdue or has not completed.</Notice>}
            {payload.error ? <Notice tone="warning">{String(payload.error)}</Notice> : null}
            <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt>Queued webhook events</dt><dd>{pending}</dd></div>
                <div><dt>Events needing manual recovery</dt><dd>{failed}</dd></div>
                <div><dt>Payments with uncertain outcomes</dt><dd>{uncertain}</dd></div>
                <div><dt>Paid sites awaiting provisioning</dt><dd>{queued}</dd></div>
                <div><dt>Site resource changes awaiting completion</dt><dd>{resourceChanges}</dd></div>
                <div><dt>Subscriptions past their grace period</dt><dd>{expiredGrace}</dd></div>
                <div><dt>Fulfillments needing manual recovery</dt><dd>{failedFulfillment}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">Worker summary: {JSON.stringify(payload.result ?? {})}</p>
        </div>
    </div>;
}
