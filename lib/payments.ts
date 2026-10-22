import 'server-only';
import { desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { moneyFromMinor } from '@/lib/billing-rules';
import { asList, asRecord, asString } from '@/lib/paddle-data';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error';

export type PaymentState = 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'pending' | 'cancelled' | 'draft';

const PAYMENT_STATES: { value: PaymentState; label: string; variant: BadgeVariant }[] = [
    { value: 'paid', label: 'Paid', variant: 'success' },
    { value: 'failed', label: 'Failed', variant: 'error' },
    { value: 'refunded', label: 'Refunded', variant: 'warning' },
    { value: 'partially_refunded', label: 'Partially refunded', variant: 'warning' },
    { value: 'pending', label: 'Pending', variant: 'info' },
    { value: 'cancelled', label: 'Cancelled', variant: 'neutral' },
    { value: 'draft', label: 'Draft', variant: 'neutral' },
];

export function paymentState(record: { status: string; refundedAmount: number | null }): PaymentState {
    if (record.status === 'REFUNDED') return 'refunded';
    if ((record.refundedAmount ?? 0) > 0) return 'partially_refunded';
    switch (record.status) {
        case 'PAID': return 'paid';
        case 'OVERDUE': return 'failed';
        case 'PENDING': return 'pending';
        case 'CANCELLED': return 'cancelled';
        default: return 'draft';
    }
}

export const stateInfo = (state: PaymentState) => PAYMENT_STATES.find((item) => item.value === state)!;

/** Paddle's own page for a transaction, when the reference is one of theirs. */
function paddleTransactionUrl(reference: string | null) {
    if (!reference?.startsWith('txn_')) return null;
    const host = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'vendors.paddle.com' : 'sandbox-vendors.paddle.com';
    return `https://${host}/transactions-v2/${reference}`;
}

export interface PaymentLine {
    name: string;
    kind: 'Plan' | 'App' | 'Other';
    quantity: number;
    unit: number | null;
    total: number | null;
    href?: string;
}

export interface PaymentAdjustment {
    id: string;
    action: string;
    reason: string | null;
    status: string | null;
    amount: number | null;
    currency: string | null;
    createdAt: string | null;
}

export async function loadPaymentDetail(id: string) {
    const [row] = await db
        .select({ record: schema.billingRecord, user: schema.user })
        .from(schema.billingRecord)
        .innerJoin(schema.user, eq(schema.user.id, schema.billingRecord.userId))
        .where(eq(schema.billingRecord.id, id))
        .limit(1);
    if (!row) return null;
    const { record, user } = row;
    const reference = record.paymentReference ?? record.invoiceNumber;

    const events = await db
        .select()
        .from(schema.paddleEvent)
        .where(or(
            sql`${schema.paddleEvent.payload}->'data'->>'id' = ${reference}`,
            sql`${schema.paddleEvent.payload}->'data'->>'transaction_id' = ${reference}`,
        ))
        .orderBy(desc(schema.paddleEvent.receivedAt))
        .limit(100);

    const transactionEvent = events.find((event) => event.eventType.startsWith('transaction.'));
    const canonical = await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, reference) });
    const data = asRecord(canonical?.payload ?? asRecord(transactionEvent?.payload).data);
    const details = asRecord(data.details);
    const totals = asRecord(details.totals);
    const currency = asString(totals.currency_code) ?? asString(data.currency_code) ?? record.currency;

    const fromMinorUnits = (value: unknown) => moneyFromMinor(value, currency);
    const adjustments = new Map<string, PaymentAdjustment>();
    for (const event of [...events].reverse()) {
        if (!event.eventType.startsWith('adjustment.')) continue;
        const adjustment = asRecord(asRecord(event.payload).data);
        const adjustmentId = asString(adjustment.id);
        if (!adjustmentId) continue;
        adjustments.set(adjustmentId, {
            id: adjustmentId,
            action: asString(adjustment.action) ?? 'adjustment',
            reason: asString(adjustment.reason),
            status: asString(adjustment.status),
            amount: fromMinorUnits(asRecord(adjustment.totals).total),
            currency: asString(asRecord(adjustment.totals).currency_code) ?? currency,
            createdAt: asString(adjustment.created_at),
        });
    }

    // Canonical snapshots override webhook arrival order and include reconciliation repairs.
    const providerAdjustments = await db.query.billingProviderRecord.findMany({ where: sql`${schema.billingProviderRecord.kind} = 'ADJUSTMENT' and ${schema.billingProviderRecord.payload}->>'transaction_id' = ${reference}` });
    for (const item of providerAdjustments) {
        const adjustment = asRecord(item.payload);
        adjustments.set(item.id, {
            id: item.id, action: asString(adjustment.action) ?? 'adjustment', reason: asString(adjustment.reason),
            status: asString(adjustment.status), amount: fromMinorUnits(asRecord(adjustment.totals).total),
            currency: asString(adjustment.currency_code) ?? currency, createdAt: asString(adjustment.created_at),
        });
    }

    const items = asList(data.items).map(asRecord);
    const priceIds = items.map((item) => asString(asRecord(item.price).id)).filter((value): value is string => Boolean(value));
    const [plans, apps] = priceIds.length
        ? await Promise.all([
            db.select({ id: schema.plan.id, name: schema.plan.name, price: schema.plan.paddlePriceId }).from(schema.plan).where(inArray(schema.plan.paddlePriceId, priceIds)),
            db.select({ id: schema.appCatalog.id, name: schema.appCatalog.name, price: schema.appCatalog.paddlePriceId }).from(schema.appCatalog).where(inArray(schema.appCatalog.paddlePriceId, priceIds)),
        ])
        : [[], []];
    const lineTotals = new Map(asList(details.line_items).map(asRecord).map((line) => [asString(line.price_id), asRecord(line.totals)] as const));
    const lines: PaymentLine[] = items.map((item) => {
        const price = asRecord(item.price);
        const priceId = asString(price.id);
        const plan = plans.find((candidate) => candidate.price === priceId);
        const app = apps.find((candidate) => candidate.price === priceId);
        const quantity = Number(item.quantity) || 1;
        return {
            name: plan?.name ?? app?.name ?? asString(price.name) ?? asString(price.description) ?? 'Item',
            kind: plan ? 'Plan' : app ? 'App' : 'Other',
            quantity,
            unit: fromMinorUnits(asRecord(price.unit_price).amount),
            total: fromMinorUnits(lineTotals.get(priceId)?.total),
            href: plan ? `/admin/plans/${plan.id}/edit` : app ? `/admin/apps/${app.id}` : undefined,
        };
    });

    // How it was paid, and what the card network said when it was not.
    const attempts = asList(data.payments).map(asRecord).map((attempt) => {
        const method = asRecord(attempt.method_details);
        const card = asRecord(method.card);
        return {
            id: asString(attempt.payment_attempt_id),
            status: asString(attempt.status),
            errorCode: asString(attempt.error_code),
            amount: fromMinorUnits(attempt.amount),
            method: asString(method.type),
            card: asString(card.last4) ? `${asString(card.type) ?? 'Card'} •••• ${asString(card.last4)}${card.expiry_month ? ` · expires ${card.expiry_month}/${card.expiry_year}` : ''}` : null,
            at: asString(attempt.captured_at) ?? asString(attempt.created_at),
        };
    });

    const [subscription] = record.subscriptionId
        ? await db
            .select({ subscription: schema.subscription, plan: schema.plan })
            .from(schema.subscription)
            .innerJoin(schema.plan, eq(schema.plan.id, schema.subscription.planId))
            .where(eq(schema.subscription.id, record.subscriptionId))
            .limit(1)
        : [];

    const [others, purchases] = await Promise.all([
        db.select().from(schema.billingRecord).where(eq(schema.billingRecord.userId, record.userId)).orderBy(desc(schema.billingRecord.createdAt)).limit(8),
        db
            .select({ purchase: schema.appPurchase, app: schema.appCatalog.name })
            .from(schema.appPurchase)
            .leftJoin(schema.appCatalog, eq(schema.appCatalog.id, schema.appPurchase.appId))
            .where(eq(schema.appPurchase.userId, record.userId))
            .orderBy(desc(schema.appPurchase.createdAt))
            .limit(20),
    ]);

    return {
        record,
        user,
        reference,
        currency,
        state: paymentState(record),
        subscription: subscription ?? null,
        lines,
        totals: {
            subtotal: fromMinorUnits(totals.subtotal),
            discount: fromMinorUnits(totals.discount),
            tax: fromMinorUnits(totals.tax),
            total: fromMinorUnits(totals.grand_total) ?? fromMinorUnits(totals.total),
            fee: moneyFromMinor(asRecord(details.payout_totals).fee, asString(asRecord(details.payout_totals).currency_code) ?? currency) ?? fromMinorUnits(totals.fee),
            earnings: moneyFromMinor(asRecord(details.payout_totals).earnings, asString(asRecord(details.payout_totals).currency_code) ?? currency) ?? fromMinorUnits(totals.earnings),
        },
        paddle: {
            status: asString(data.status),
            origin: asString(data.origin),
            customerId: asString(data.customer_id),
            subscriptionId: asString(data.subscription_id),
            invoiceNumber: asString(data.invoice_number),
            billedAt: asString(data.billed_at),
            url: paddleTransactionUrl(reference),
        },
        attempts,
        adjustments: [...adjustments.values()],
        events,
        others: others.filter((other) => other.id !== record.id),
        purchases,
    };
}
