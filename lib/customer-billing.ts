import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paddleRequest } from '@/lib/paddle-catalog';
import { loadPaymentDetail, paymentState, stateInfo } from '@/lib/payments';
import { asRecord, asString } from '@/lib/paddle-data';
import { moneyFromMinor } from '@/lib/billing-rules';

export interface TransactionRow {
    id: string;
    date: Date;
    description: string;
    amount: number;
    currency: string;
    state: ReturnType<typeof paymentState>;
    label: string;
    variant: 'neutral' | 'success' | 'info' | 'warning' | 'error';
    reference: string;
}

/** Everything billed to the customer, newest first: paid, failed, pending and refunded. */
export async function listCustomerTransactions(userId: string, limit = 100): Promise<TransactionRow[]> {
    const records = await db.query.billingRecord.findMany({ where: eq(schema.billingRecord.userId, userId), orderBy: desc(schema.billingRecord.createdAt), limit });
    return records.map((record) => {
        const state = paymentState(record);
        const info = stateInfo(state);
        return {
            id: record.id,
            date: record.paidAt ?? record.issuedAt ?? record.createdAt,
            description: record.description,
            amount: record.amount,
            currency: record.currency,
            state,
            label: info.label,
            variant: info.variant,
            reference: record.paymentReference ?? record.invoiceNumber,
        };
    });
}

/** One invoice, only for its owner. Admin-only fields (fees, earnings, raw events) are not exposed. */
export async function getCustomerInvoice(userId: string, id: string) {
    const detail = await loadPaymentDetail(id);
    if (!detail || detail.record.userId !== userId) return null;
    const { record, state, currency, totals, lines, attempts, adjustments, reference } = detail;
    return {
        record, state, currency, reference, lines, adjustments,
        totals: { subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total },
        failure: attempts.find((attempt) => attempt.errorCode)?.errorCode ?? null,
        card: attempts.find((attempt) => attempt.card)?.card ?? null,
    };
}

/** A short-lived link to Paddle's PDF invoice for a settled transaction the customer owns. */
export async function customerInvoicePdfUrl(userId: string, id: string) {
    const record = await db.query.billingRecord.findFirst({ where: and(eq(schema.billingRecord.id, id), eq(schema.billingRecord.userId, userId)) });
    const reference = record?.paymentReference ?? record?.invoiceNumber;
    if (!record || !reference?.startsWith('txn_') || !['PAID', 'REFUNDED'].includes(record.status)) return null;
    const data = asRecord(await paddleRequest(`/transactions/${encodeURIComponent(reference)}/invoice`));
    const url = asString(data.url);
    return url && url.startsWith('https://') ? url : null;
}

/** A discount currently applied to a subscription, for display. Failure to read it never breaks the page. */
export async function loadSubscriptionDiscount(snapshot: unknown): Promise<{ type?: string; amount?: string; currency_code?: string } | null> {
    const id = asString(asRecord(asRecord(snapshot).discount).id);
    if (!id) return null;
    try {
        const data = asRecord(await Promise.race([
            paddleRequest(`/discounts/${encodeURIComponent(id)}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
        ]));
        // Temporary discounts the platform attaches for account credits are not a customer-facing offer.
        if (asRecord(data.custom_data).creditRedemptionId) return null;
        return { type: asString(data.type) ?? undefined, amount: asString(data.amount) ?? undefined, currency_code: asString(data.currency_code) ?? undefined };
    } catch {
        return null;
    }
}

export const formatMinorAmount = (amount: string, currency: string) => {
    const major = moneyFromMinor(amount, currency);
    return major == null ? amount : new Intl.NumberFormat('en', { style: 'currency', currency }).format(major);
};
