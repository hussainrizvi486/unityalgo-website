import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { requireCustomerSession } from '@/lib/customer-session';
import { getCustomerInvoice } from '@/lib/customer-billing';
import { stateInfo } from '@/lib/payments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export const metadata = { title: 'Invoice' };

const STATE_NOTE: Record<string, string> = {
    paid: 'Payment received. Thank you.',
    failed: 'This payment was declined and you have not been charged. Update your payment method on the subscription page and we will retry.',
    pending: 'This payment is still being processed. It can take a few minutes; refresh to check.',
    refunded: 'This payment was refunded in full. Refunds reach your card within a few business days.',
    partially_refunded: 'Part of this payment was refunded. Refunds reach your card within a few business days.',
    cancelled: 'This payment was canceled and you were not charged.',
    draft: 'This invoice has not been issued yet.',
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pdf?: string }> }) {
    const session = await requireCustomerSession();
    const [{ id }, { pdf }] = await Promise.all([params, searchParams]);
    const invoice = await getCustomerInvoice(session.userId, id);
    if (!invoice) notFound();
    const { record, state, currency, lines, totals, adjustments, card, failure } = invoice;
    const info = stateInfo(state);
    const money = (amount: number | null | undefined) => (amount == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount));
    const when = (value: Date | null) => (value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(value) : '—');
    const downloadable = invoice.reference.startsWith('txn_') && (record.status === 'PAID' || record.status === 'REFUNDED');

    return (
        <div className="portal-detail">
            <Link href="/dashboard/subscription" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="size-4" />Back to billing
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="portal-page-title tabular-nums">{money(record.amount)}</h1>
                        <Badge variant={info.variant}>{info.label}</Badge>
                    </div>
                    <p className="mt-1 portal-text-body text-muted-foreground">{record.description}</p>
                    <p className="mt-1 break-all font-mono portal-text-caption text-muted-foreground">{invoice.reference}</p>
                </div>
                {downloadable && (
                    <Button asChild variant="outline"><a href={`/dashboard/subscription/invoices/${record.id}/pdf`}><Download className="size-4" />Download PDF</a></Button>
                )}
            </div>

            {pdf === 'unavailable' && <Notice tone="warning" className="mt-6">The PDF could not be prepared right now. Please try again in a moment.</Notice>}
            <Notice tone={state === 'failed' ? 'error' : state === 'paid' ? 'success' : 'info'} className="mt-6">{STATE_NOTE[state] ?? ''}{failure && state === 'failed' ? ` (Reason: ${failure.replaceAll('_', ' ')}.)` : ''}</Notice>

            <section className="mt-8 overflow-hidden rounded-xl border border-border">
                <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/50 px-4 py-2 portal-text-caption font-semibold text-muted-foreground"><span>Item</span><span>Amount</span></div>
                {lines.length === 0 ? (
                    <div className="flex justify-between px-4 py-3 portal-text-body"><span>{record.description}</span><span className="tabular-nums">{money(record.amount)}</span></div>
                ) : lines.map((line, index) => (
                    <div key={index} className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-0 portal-text-body">
                        <span><span className="font-medium">{line.name}</span>{line.quantity > 1 ? <span className="text-muted-foreground"> × {line.quantity}</span> : null}</span>
                        <span className="tabular-nums">{money(line.total ?? (line.unit != null ? line.unit * line.quantity : null))}</span>
                    </div>
                ))}
                <dl className="space-y-1 border-t border-border bg-muted/30 px-4 py-3 portal-text-body">
                    {totals.subtotal != null && <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>}
                    {totals.discount ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">-{money(totals.discount)}</dd></div> : null}
                    {totals.tax != null && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(totals.tax)}</dd></div>}
                    <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(totals.total ?? record.amount)}</dd></div>
                </dl>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/70 p-3"><p className="portal-text-caption text-muted-foreground">Date</p><p className="mt-1 font-semibold">{when(record.paidAt ?? record.issuedAt ?? record.createdAt)}</p></div>
                {record.periodStart && record.periodEnd ? <div className="rounded-lg border border-border/70 p-3"><p className="portal-text-caption text-muted-foreground">Covers</p><p className="mt-1 font-semibold">{when(record.periodStart)} to {when(record.periodEnd)}</p></div> : null}
                {card ? <div className="rounded-lg border border-border/70 p-3"><p className="portal-text-caption text-muted-foreground">Paid with</p><p className="mt-1 font-semibold">{card}</p></div> : null}
            </section>

            {adjustments.length > 0 && (
                <section className="mt-6 rounded-xl border border-border p-4">
                    <h2 className="text-base">Refunds and credits</h2>
                    <ul className="mt-2 space-y-1 portal-text-body">
                        {adjustments.map((adjustment) => (
                            <li key={adjustment.id} className="flex justify-between gap-3">
                                <span className="capitalize">{adjustment.action}{adjustment.createdAt ? ` · ${when(new Date(adjustment.createdAt))}` : ''}{adjustment.status ? ` · ${adjustment.status.replaceAll('_', ' ')}` : ''}</span>
                                <span className="tabular-nums">{money(adjustment.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
