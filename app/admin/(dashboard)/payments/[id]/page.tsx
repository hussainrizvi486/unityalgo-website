import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-session';
import { formatDate, formatDateTime, formatPrice } from '@/lib/admin-format';
import { loadPaymentDetail, paymentState, stateInfo } from '@/lib/payments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export const metadata = { title: 'Payment' };

type Variant = 'neutral' | 'success' | 'info' | 'warning' | 'error';
const EVENT_BADGE: Record<string, Variant> = { PROCESSED: 'success', FAILED: 'error', PENDING: 'info', IGNORED: 'neutral' };

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`rounded-xl border border-border p-card ${className ?? ''}`}>
            <h2 className="">{title}</h2>
            <div className="mt-3 portal-text-body">{children}</div>
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-gap py-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all text-right font-medium">{children}</dd>
        </div>
    );
}

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;
    const detail = await loadPaymentDetail(id);
    if (!detail) notFound();
    const { record, user, state, currency, totals, lines, attempts, adjustments, events, subscription, others, purchases, paddle } = detail;
    const info = stateInfo(state);
    const money = (amount: number | null | undefined) => (amount == null ? '—' : formatPrice(amount, currency));
    const customer = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    const failure = attempts.find((attempt) => attempt.errorCode);
    const refundTotal = record.refundedAmount ?? adjustments.filter((a) => a.action === 'refund' && a.status !== 'rejected').reduce((sum, a) => sum + (a.amount ?? 0), 0);

    return (
        <div className="portal-detail">
            <Link href="/admin/payments" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to payments
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="portal-page-title tabular-nums">{formatPrice(record.amount, record.currency)}</h1>
                        <Badge variant={info.variant}>{info.label}</Badge>
                    </div>
                    <p className="mt-1 portal-text-body text-muted-foreground">{record.description}</p>
                    <p className="mt-1 break-all portal-text-caption text-muted-foreground">{detail.reference}</p>
                </div>
                {paddle.url && (
                    <Button asChild variant="outline" size="sm">
                        <a href={paddle.url} target="_blank" rel="noopener noreferrer">Open in Paddle <ArrowUpRight className="size-4" /></a>
                    </Button>
                )}
            </div>

            {state === 'failed' && (
                <Notice tone="error" className="mt-6">
                    <span className="font-medium">This payment was not collected.</span>{' '}
                    {failure?.errorCode ? `The card network answered: ${failure.errorCode.replaceAll('_', ' ')}. ` : ''}
                    Paddle retries on its own schedule; the invoice turns paid when a retry succeeds.
                </Notice>
            )}
            {(state === 'refunded' || state === 'partially_refunded') && (
                <Notice tone="warning" className="mt-6">
                    {state === 'refunded' ? 'Fully refunded' : 'Partially refunded'}: {formatPrice(refundTotal, record.currency)} of {formatPrice(record.amount, record.currency)}
                    {record.refundedAt ? ` on ${formatDate(record.refundedAt)}` : ''}.
                </Notice>
            )}

            <div className="mt-6 grid gap-gap md:grid-cols-2 xl:grid-cols-3">
                <Card title="Payment">
                    <dl>
                        <Row label="Status"><Badge variant={info.variant}>{info.label}</Badge></Row>
                        <Row label="Amount">{formatPrice(record.amount, record.currency)}</Row>
                        {refundTotal > 0 && <Row label="Refunded">{formatPrice(refundTotal, record.currency)}</Row>}
                        {refundTotal > 0 && <Row label="Net kept">{formatPrice(Math.max(0, record.amount - refundTotal), record.currency)}</Row>}
                        <Row label="Issued">{formatDateTime(record.issuedAt)}</Row>
                        <Row label="Paid">{formatDateTime(record.paidAt)}</Row>
                        {record.dueDate && <Row label="Due">{formatDateTime(record.dueDate)}</Row>}
                        <Row label="Period">{record.periodStart ? `${formatDate(record.periodStart)} – ${formatDate(record.periodEnd)}` : '—'}</Row>
                        <Row label="Method">{record.paymentMethod ?? '—'}</Row>
                        <Row label="Invoice no.">{record.invoiceNumber}</Row>
                    </dl>
                </Card>

                <Card title="Customer">
                    <dl>
                        <Row label="Name"><Link href={`/admin/users/${user.id}`} className="text-primary hover:underline">{customer}</Link></Row>
                        <Row label="Email">{user.email}</Row>
                        {user.company && <Row label="Company">{user.company}</Row>}
                        <Row label="Customer since">{formatDate(user.createdAt)}</Row>
                        {paddle.customerId && <Row label="Paddle customer">{paddle.customerId}</Row>}
                    </dl>
                </Card>

                <Card title="Subscription">
                    {subscription ? (
                        <dl>
                            <Row label="Plan"><Link href={`/admin/plans/${subscription.plan.id}/edit`} className="text-primary hover:underline">{subscription.plan.name}</Link></Row>
                            <Row label="Status"><Badge variant={subscription.subscription.status === 'ACTIVE' ? 'success' : subscription.subscription.status === 'CANCELED' ? 'neutral' : 'warning'}>{subscription.subscription.status.toLowerCase().replace('_', ' ')}</Badge></Row>
                            <Row label="Renews">{subscription.subscription.cancelAtPeriodEnd ? 'Cancels at period end' : formatDate(subscription.subscription.currentPeriodEnd)}</Row>
                            <Row label="Started">{formatDate(subscription.subscription.startedAt)}</Row>
                            {(paddle.subscriptionId ?? subscription.subscription.paddleSubscriptionId) && <Row label="Paddle subscription">{paddle.subscriptionId ?? subscription.subscription.paddleSubscriptionId}</Row>}
                        </dl>
                    ) : (
                        <p className="text-muted-foreground">Not linked to a subscription.</p>
                    )}
                </Card>
            </div>

            <div className="mt-4 grid gap-gap lg:grid-cols-2">
                <Card title="What was paid for">
                    {lines.length ? (
                        <>
                            <ul className="divide-y divide-border/60">
                                {lines.map((line, index) => (
                                    <li key={index} className="flex items-start justify-between gap-gap py-2">
                                        <span>
                                            {line.href ? <Link href={line.href} className="font-medium hover:text-primary hover:underline">{line.name}</Link> : <span className="font-medium">{line.name}</span>}
                                            <span className="ml-2"><Badge variant="neutral">{line.kind}</Badge></span>
                                            <span className="block portal-text-caption text-muted-foreground">{line.quantity} × {money(line.unit)}</span>
                                        </span>
                                        <span className="font-medium tabular-nums">{money(line.total ?? (line.unit != null ? line.unit * line.quantity : null))}</span>
                                    </li>
                                ))}
                            </ul>
                            <dl className="mt-3 border-t border-border pt-3">
                                <Row label="Subtotal">{money(totals.subtotal)}</Row>
                                {totals.discount ? <Row label="Discount">−{money(totals.discount)}</Row> : null}
                                <Row label="Tax">{money(totals.tax)}</Row>
                                <Row label="Total charged">{money(totals.total)}</Row>
                                {totals.fee != null && <Row label="Paddle fee">{money(totals.fee)}</Row>}
                                {totals.earnings != null && <Row label="Net earnings">{money(totals.earnings)}</Row>}
                            </dl>
                        </>
                    ) : (
                        <p className="text-muted-foreground">No itemised breakdown was recorded. {record.description}</p>
                    )}
                </Card>

                <Card title="Payment attempts">
                    {attempts.length ? (
                        <ul className="divide-y divide-border/60">
                            {attempts.map((attempt, index) => (
                                <li key={attempt.id ?? index} className="py-2">
                                    <div className="flex items-center justify-between gap-gap">
                                        <span className="font-medium">{attempt.card ?? attempt.method ?? 'Payment'}</span>
                                        <Badge variant={attempt.status === 'captured' ? 'success' : attempt.errorCode || attempt.status === 'error' ? 'error' : 'neutral'}>{attempt.status ?? 'unknown'}</Badge>
                                    </div>
                                    <p className="portal-text-caption text-muted-foreground">
                                        {attempt.amount != null ? money(attempt.amount) : ''}{attempt.at ? ` · ${formatDateTime(attempt.at)}` : ''}
                                        {attempt.errorCode ? ` · ${attempt.errorCode.replaceAll('_', ' ')}` : ''}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">No attempt details were recorded for this payment.</p>
                    )}
                </Card>
            </div>

            <Card title={`Refunds and credits (${adjustments.length})`} className="mt-4">
                {adjustments.length ? (
                    <ul className="divide-y divide-border/60">
                        {adjustments.map((adjustment) => (
                            <li key={adjustment.id} className="flex flex-wrap items-center justify-between gap-gap py-2">
                                <span>
                                    <span className="font-medium capitalize">{adjustment.action}</span>
                                    <span className="ml-2"><Badge variant={adjustment.status === 'approved' ? 'success' : adjustment.status === 'rejected' ? 'error' : 'info'}>{adjustment.status ?? 'recorded'}</Badge></span>
                                    <span className="block portal-text-caption text-muted-foreground">{adjustment.id}{adjustment.reason ? ` · ${adjustment.reason}` : ''}{adjustment.createdAt ? ` · ${formatDateTime(adjustment.createdAt)}` : ''}</span>
                                </span>
                                <span className="font-medium tabular-nums">{adjustment.amount != null ? formatPrice(adjustment.amount, adjustment.currency ?? currency) : '—'}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground">Nothing has been refunded or credited.</p>
                )}
            </Card>

            <div className="mt-4 grid gap-gap lg:grid-cols-2">
                <Card title={`Paid apps for this customer (${purchases.length})`}>
                    {purchases.length ? (
                        <ul className="divide-y divide-border/60">
                            {purchases.map(({ purchase, app }) => (
                                <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-gap py-2">
                                    <span>
                                        <span className="font-medium">{app ?? 'App'}</span>
                                        <span className="block portal-text-caption text-muted-foreground">
                                            <Link href={`/admin/sites/${purchase.siteId}`} className="hover:text-primary hover:underline">Site</Link> · since {formatDate(purchase.createdAt)}
                                            {purchase.billingMode === 'test' ? ' · test mode, not charged' : ''}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="tabular-nums">{formatPrice(purchase.priceAmount, purchase.currency)}/mo</span>
                                        <Badge variant={purchase.status === 'ACTIVE' ? 'success' : 'neutral'}>{purchase.status.toLowerCase()}</Badge>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">No paid apps.</p>
                    )}
                </Card>

                <Card title="Other payments by this customer">
                    {others.length ? (
                        <ul className="divide-y divide-border/60">
                            {others.map((other) => {
                                const otherInfo = stateInfo(paymentState(other));
                                return (
                                    <li key={other.id} className="flex flex-wrap items-center justify-between gap-gap py-2">
                                        <span>
                                            <Link href={`/admin/payments/${other.id}`} className="font-medium hover:text-primary hover:underline">{other.description}</Link>
                                            <span className="block portal-text-caption text-muted-foreground">{formatDate(other.paidAt ?? other.issuedAt ?? other.createdAt)}</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span className="tabular-nums">{formatPrice(other.amount, other.currency)}</span>
                                            <Badge variant={otherInfo.variant}>{otherInfo.label}</Badge>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">This is their only payment.</p>
                    )}
                </Card>
            </div>

            <Card title={`Paddle events (${events.length})`} className="mt-4">
                {events.length ? (
                    <ul className="divide-y divide-border/60">
                        {events.map((event) => (
                            <li key={event.id} className="py-2">
                                <div className="flex flex-wrap items-center justify-between gap-gap">
                                    <span className="font-medium">{event.eventType}</span>
                                    <span className="flex items-center gap-2">
                                        <span className="portal-text-caption text-muted-foreground">{formatDateTime(event.receivedAt)}</span>
                                        <Badge variant={EVENT_BADGE[event.status] ?? 'neutral'}>{event.status.toLowerCase()}</Badge>
                                    </span>
                                </div>
                                {event.error && <p className="mt-1 portal-text-caption text-destructive">{event.error}</p>}
                                <details className="mt-1">
                                    <summary className="cursor-pointer portal-text-caption font-medium text-primary">Raw payload{event.attempts > 1 ? ` · delivered ${event.attempts} times` : ''}</summary>
                                    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(event.payload, null, 2)}</pre>
                                </details>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground">No Paddle events are on file for this payment.</p>
                )}
            </Card>

            {record.notes && <Card title="Notes" className="mt-4"><p className="whitespace-pre-wrap">{record.notes}</p></Card>}
        </div>
    );
}
