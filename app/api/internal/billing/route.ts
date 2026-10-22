import { runBillingWorker } from '@/lib/billing-worker';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { asRecord } from '@/lib/paddle-data';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorize(request: Request) {
    const secret = process.env.BILLING_WORKER_SECRET;
    if (!secret) return Response.json({ error: 'Worker not configured' }, { status: 503 });
    const expected = Buffer.from(`Bearer ${secret}`);
    const provided = Buffer.from(request.headers.get('authorization') ?? '');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}
export async function POST(request: Request) {
    const denied = authorize(request); if (denied) return denied;
    return Response.json(await runBillingWorker());
}
export async function GET(request: Request) {
    const denied = authorize(request); if (denied) return denied;
    const worker = await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, 'billing:worker') });
    const state = asRecord(worker?.payload);
    const stale = !state.finishedAt || Date.now() - new Date(String(state.finishedAt)).getTime() > 5 * 60_000;
    const [pendingEvents, exhaustedEvents, unknownPayments, pendingSites] = await Promise.all([
        db.$count(schema.paddleEvent, inArray(schema.paddleEvent.status, ['PENDING', 'FAILED'])),
        db.$count(schema.paddleEvent, and(eq(schema.paddleEvent.status, 'FAILED'), sql`${schema.paddleEvent.attempts} >= 20`)),
        db.$count(schema.billingOperation, eq(schema.billingOperation.status, 'UNKNOWN')),
        db.$count(schema.siteOrder, eq(schema.siteOrder.status, 'READY')),
    ]);
    const reconciliationStale = !state.reconciledAt || Date.now() - new Date(String(state.reconciledAt)).getTime() > 2 * 86400_000;
    const result = asRecord(state.result);
    const processingFailures = Number(asRecord(result.lifecycle).failed ?? 0) + Number(asRecord(result.payments).failed ?? 0);
    const healthy = !stale && !state.error && !exhaustedEvents && !reconciliationStale && !processingFailures;
    return Response.json({ healthy, worker: state, pendingEvents, exhaustedEvents, unknownPayments, pendingSites, reconciliationStale, processingFailures, publicWebhookUrlConfigured: !!process.env.PUBLIC_APP_URL }, { status: healthy ? 200 : 503 });
}
