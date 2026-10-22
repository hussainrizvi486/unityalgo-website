import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDateTime, formatPrice } from '@/lib/admin-format';
import { paymentState, stateInfo } from '@/lib/payments';
import { AdminPageHeader } from '@/components/admin/page-header';
import { PaymentsList, type PaymentRow } from './payments-list';

export const metadata = { title: 'Payments' };

function perCurrency(totals: Map<string, number>) {
    const parts = [...totals.entries()].filter(([, amount]) => amount !== 0).map(([code, amount]) => formatPrice(amount, code));
    return parts.length ? parts.join(' · ') : '—';
}

export default async function AdminPaymentsPage() {
    await requireAdmin();
    const [records, totalCount] = await Promise.all([
        db
            .select({ record: schema.billingRecord, user: schema.user, plan: schema.plan.name })
            .from(schema.billingRecord)
            .innerJoin(schema.user, eq(schema.user.id, schema.billingRecord.userId))
            .leftJoin(schema.subscription, eq(schema.subscription.id, schema.billingRecord.subscriptionId))
            .leftJoin(schema.plan, eq(schema.plan.id, schema.subscription.planId))
            .orderBy(desc(schema.billingRecord.createdAt))
            .limit(ADMIN_LIST_LIMIT),
        db.$count(schema.billingRecord),
    ]);

    const collected = new Map<string, number>();
    const refunded = new Map<string, number>();
    const failed = new Map<string, number>();
    const add = (map: Map<string, number>, code: string, amount: number) => map.set(code, (map.get(code) ?? 0) + amount);

    const rows: PaymentRow[] = records.map(({ record, user, plan }) => {
        const state = paymentState(record);
        const info = stateInfo(state);
        if (state === 'paid' || state === 'partially_refunded' || state === 'refunded') add(collected, record.currency, record.amount);
        if (record.refundedAmount) add(refunded, record.currency, record.refundedAmount);
        if (state === 'failed') add(failed, record.currency, record.amount);
        return {
            id: record.id,
            reference: record.paymentReference ?? record.invoiceNumber,
            description: record.description,
            customerName: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
            customerEmail: user.email,
            plan: record.paymentMethod === 'Paddle' ? record.description.replace(/ subscription billing$/, '') : plan ?? null,
            amount: record.amount,
            amountLabel: formatPrice(record.amount, record.currency),
            refundedLabel: record.refundedAmount ? formatPrice(record.refundedAmount, record.currency) : null,
            state,
            stateLabel: info.label,
            stateVariant: info.variant,
            method: record.paymentMethod ?? '—',
            date: formatDateTime(record.paidAt ?? record.issuedAt ?? record.createdAt),
        };
    });

    const stats = [
        { label: 'Collected', value: perCurrency(collected), hint: 'Paid, before refunds' },
        { label: 'Refunded', value: perCurrency(refunded), hint: `${rows.filter((row) => row.refundedLabel).length} payments` },
        { label: 'Failed', value: String(rows.filter((row) => row.state === 'failed').length), hint: perCurrency(failed) === '—' ? 'No money outstanding' : `${perCurrency(failed)} not collected` },
        { label: 'Payments', value: String(totalCount), hint: 'All time' },
    ];

    return (
        <div>
            <AdminPageHeader
                title="Payments"
                subtitle={rows.length < totalCount ? `Showing the ${rows.length} most recent of ${totalCount}` : `${totalCount} total`}
            />
            <Link href="/admin/billing-status" className="mb-4 inline-block text-sm underline">Billing processing status</Link>
            <div className="mb-6 grid gap-gap sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border p-card">
                        <p className="portal-text-caption text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">{stat.value}</p>
                        <p className="mt-1 portal-text-caption text-muted-foreground">{stat.hint}</p>
                    </div>
                ))}
            </div>
            <PaymentsList rows={rows} />
        </div>
    );
}
