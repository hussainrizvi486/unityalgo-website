import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { closeDb, db, schema } from '../lib/db';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SECRET = process.env.PADDLE_WEBHOOK_SECRET!;

const subscriptionFor = async (userId: string, productId: string) =>
    (await db.query.subscription.findFirst({ where: and(eq(schema.subscription.userId, userId), eq(schema.subscription.productId, productId)) })) ?? null;
const invoice$ = async (invoiceNumber: string) =>
    (await db.query.billingRecord.findFirst({ where: eq(schema.billingRecord.invoiceNumber, invoiceNumber) })) ?? null;
const eventRow = async (id: string) => (await db.query.paddleEvent.findFirst({ where: eq(schema.paddleEvent.id, id) })) ?? null;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') =>
    c ? (pass++, console.log(`  \x1b[32mok\x1b[0m   ${n}`))
      : (fail++, console.log(`  \x1b[31mFAIL\x1b[0m ${n}${d ? ' — ' + d : ''}`));

const PREFIX = 'pw-e2e';

async function post(event: Record<string, unknown>, opts: { badSig?: boolean; oldTs?: boolean } = {}) {
    const raw = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000) - (opts.oldTs ? 600 : 0);
    const h1 = createHmac('sha256', opts.badSig ? 'wrong' : SECRET).update(`${ts}:${raw}`).digest('hex');
    const res = await fetch(`${BASE}/api/paddle/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'paddle-signature': `ts=${ts};h1=${h1}` },
        body: raw,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
}

const txn = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    customer_id: 'ctm_e2e',
    subscription_id: 'sub_e2e_1',
    currency_code: 'USD',
    details: { totals: { grand_total: '4900', currency_code: 'USD' } },
    billing_period: { starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z' },
    ...extra,
});

async function main() {
    // -- fixtures ------------------------------------------------------
    const product = await db.query.product.findFirst({ columns: { id: true } });
    if (!product) throw new Error('no Product rows — cannot run');

    const [user] = await db
        .insert(schema.user)
        .values({ email: `${PREFIX}-${randomUUID()}@example.com`, role: 'CUSTOMER', passwordHash: 'x' })
        .returning();
    const [plan] = await db
        .insert(schema.plan)
        .values({
            productId: product.id, name: `${PREFIX} plan`, slug: `${PREFIX}-${randomUUID().slice(0, 8)}`,
            priceAmount: 49, isActive: true, features: [],
            paddlePriceId: `pri_${PREFIX}_${randomUUID().slice(0, 8)}`,
        })
        .returning();
    const custom = { custom_data: { userId: user.id, planId: plan.id } };

    console.log('\n── Rejects what it should ──────────────────────');
    ok('bad signature => 401', (await post({ event_id: randomUUID(), event_type: 'transaction.completed', data: {} }, { badSig: true })).status === 401);
    ok('replayed old timestamp => 401', (await post({ event_id: randomUUID(), event_type: 'transaction.completed', data: {} }, { oldTs: true })).status === 401);
    ok('missing event_id => 400', (await post({ event_type: 'transaction.completed', data: {} })).status === 400);

    console.log('\n── Unhandled events are recorded, not acted on ──');
    const ignoredId = randomUUID();
    const ignored = await post({ event_id: ignoredId, event_type: 'customer.updated', data: {} });
    ok('acknowledged', ignored.status === 200 && ignored.body.ignored === true, JSON.stringify(ignored.body));
    const ignoredRow = await eventRow(ignoredId);
    ok('recorded as IGNORED', ignoredRow?.status === 'IGNORED', String(ignoredRow?.status));

    console.log('\n── Purchase grants access and writes the invoice ─');
    const txnId = `txn_${PREFIX}_${randomUUID().slice(0, 8)}`;
    const buy = await post({ event_id: randomUUID(), event_type: 'transaction.completed', data: txn(txnId, custom) });
    ok('accepted', buy.status === 200, JSON.stringify(buy.body));
    let sub = await subscriptionFor(user.id, product.id);
    ok('subscription ACTIVE', sub?.status === 'ACTIVE', String(sub?.status));
    ok('renewal date taken from billing_period', sub?.currentPeriodEnd?.toISOString().startsWith('2026-10-01') === true, String(sub?.currentPeriodEnd));
    let invoice = await invoice$(txnId);
    ok('invoice PAID', invoice?.status === 'PAID', String(invoice?.status));
    ok('amount converted from minor units', invoice?.amount === 49, String(invoice?.amount));
    ok('invoice linked to the subscription', invoice?.subscriptionId === sub?.id);

    console.log('\n── Retries are idempotent ──────────────────────');
    const dupId = randomUUID();
    const first = await post({ event_id: dupId, event_type: 'transaction.completed', data: txn(txnId, custom) });
    const second = await post({ event_id: dupId, event_type: 'transaction.completed', data: txn(txnId, custom) });
    ok('second delivery reports duplicate', second.body.duplicate === true, JSON.stringify(second.body));
    ok('first was processed', first.status === 200);
    const dupRow = await eventRow(dupId);
    ok('attempts counted', (dupRow?.attempts ?? 0) >= 2, String(dupRow?.attempts));
    ok('status PROCESSED', dupRow?.status === 'PROCESSED', String(dupRow?.status));
    ok('still exactly one invoice', (await db.$count(schema.billingRecord, eq(schema.billingRecord.invoiceNumber, txnId))) === 1);

    console.log('\n── Declined charge stops access (the old gap) ──');
    const failId = `txn_${PREFIX}_fail_${randomUUID().slice(0, 8)}`;
    // Paddle keeps the subscription "active" on its side during dunning.
    await post({
        event_id: randomUUID(), event_type: 'transaction.payment_failed',
        data: txn(failId, { ...custom, status: 'active' }),
    });
    sub = await subscriptionFor(user.id, product.id);
    ok('subscription now PAST_DUE', sub?.status === 'PAST_DUE', String(sub?.status));
    const failedInvoice = await invoice$(failId);
    ok('overdue invoice written', failedInvoice?.status === 'OVERDUE', String(failedInvoice?.status));

    console.log('\n── Recovery ────────────────────────────────────');
    await post({ event_id: randomUUID(), event_type: 'transaction.completed', data: txn(failId, custom) });
    sub = await subscriptionFor(user.id, product.id);
    ok('back to ACTIVE after a successful retry', sub?.status === 'ACTIVE', String(sub?.status));
    const recovered = await invoice$(failId);
    ok('the overdue invoice becomes PAID', recovered?.status === 'PAID', String(recovered?.status));

    console.log('\n── A late failure never downgrades a paid invoice ─');
    await post({
        event_id: randomUUID(), event_type: 'transaction.payment_failed',
        data: txn(failId, { ...custom, status: 'active' }),
    });
    const afterLateFailure = await invoice$(failId);
    ok('a stale payment_failed leaves the PAID invoice PAID', afterLateFailure?.status === 'PAID', String(afterLateFailure?.status));

    console.log('\n── Refunds ─────────────────────────────────────');
    await post({
        event_id: randomUUID(), event_type: 'adjustment.created',
        data: { id: 'adj_1', transaction_id: txnId, action: 'refund', totals: { total: '2000' }, created_at: '2026-09-05T00:00:00Z' },
    });
    invoice = await invoice$(txnId);
    ok('partial refund keeps it PAID', invoice?.status === 'PAID', String(invoice?.status));
    ok('refunded amount recorded', invoice?.refundedAmount === 20, String(invoice?.refundedAmount));

    await post({
        event_id: randomUUID(), event_type: 'adjustment.created',
        data: { id: 'adj_2', transaction_id: txnId, action: 'refund', totals: { total: '4900' } },
    });
    invoice = await invoice$(txnId);
    ok('full refund marks it REFUNDED', invoice?.status === 'REFUNDED', String(invoice?.status));

    await post({
        event_id: randomUUID(), event_type: 'adjustment.created',
        data: { id: 'adj_3', transaction_id: 'txn_never_seen', action: 'refund', totals: { total: '100' } },
    });
    ok('adjustment for an unknown transaction invents nothing',
        (await invoice$('txn_never_seen')) === null);

    console.log('\n── Cancellation ────────────────────────────────');
    await post({
        event_id: randomUUID(), event_type: 'subscription.canceled',
        data: { id: 'sub_e2e_1', status: 'canceled', canceled_at: '2026-09-10T00:00:00Z', ...custom },
    });
    sub = await subscriptionFor(user.id, product.id);
    ok('status CANCELED', sub?.status === 'CANCELED', String(sub?.status));
    ok('cancellation date recorded', sub?.canceledAt?.toISOString().startsWith('2026-09-10') === true, String(sub?.canceledAt));
    ok('access still runs to the period end', sub?.currentPeriodEnd != null);

    console.log('\n── Scheduled cancellation ──────────────────────');
    await post({
        event_id: randomUUID(), event_type: 'subscription.updated',
        data: { id: 'sub_e2e_1', status: 'active', scheduled_change: { action: 'cancel' }, ...custom },
    });
    sub = await subscriptionFor(user.id, product.id);
    ok('still ACTIVE', sub?.status === 'ACTIVE', String(sub?.status));
    ok('flagged to end at period end', sub?.cancelAtPeriodEnd === true, String(sub?.cancelAtPeriodEnd));

    // -- teardown ------------------------------------------------------
    await db.delete(schema.billingRecord).where(eq(schema.billingRecord.userId, user.id));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, user.id));
    await db.delete(schema.paddleEvent).where(sql`${schema.paddleEvent.payload} #>> '{data,custom_data,userId}' = ${user.id}`);
    await db.delete(schema.paddleEvent).where(eq(schema.paddleEvent.id, ignoredId));
    await db.delete(schema.paddleEvent).where(eq(schema.paddleEvent.id, dupId));
    await db.delete(schema.plan).where(eq(schema.plan.id, plan.id));
    await db.delete(schema.user).where(eq(schema.user.id, user.id));
    console.log('\n  test data removed');

    console.log(`\n${pass} passed, ${fail} failed`);
    await closeDb();
    process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
