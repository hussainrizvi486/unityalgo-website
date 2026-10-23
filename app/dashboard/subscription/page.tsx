import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, Globe, Receipt, Store } from 'lucide-react';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';
import { getSubscriptions } from '@/app/customer/actions';
import { CREDITS_ENABLED } from '@/lib/billing-features';
import { currencyDigits } from '@/lib/billing-rules';
import { asList, asRecord, asString } from '@/lib/paddle-data';
import { formatPlanPrice } from '@/lib/pricing';
import { describeDiscount, describeSubscription } from '@/lib/subscription-view';
import { formatMinorAmount, listCustomerTransactions, loadSubscriptionDiscount } from '@/lib/customer-billing';
import { appPriceLabel, loadCatalogApps, splitAppsForPlan } from '@/lib/plan-apps';
import { loadPlanTiers } from '@/lib/app-plan-access';
import { listIdleSubscriptions } from '@/lib/subscription-claims';
import { SubscriptionApps } from '@/components/customer/subscription-apps';
import { CustomerCreditHistory } from '@/components/customer/customer-credit-history';
import { RenewalCreditControls } from '@/components/customer/renewal-credit-controls';
import { SubscriptionActions, type UpgradeChoice } from '@/components/customer/subscription-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export const metadata = { title: 'Subscription' };

const date = (value: Date | null | undefined) => (value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(value) : '—');
const when = (value: Date) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(value);
const specs = (plan: { vcpu: number | null; ramMb: number | null; storageGb: number | null; userLimit: number | null }) => [
    plan.userLimit == null ? 'Unlimited users' : `Up to ${plan.userLimit} users`,
    plan.vcpu != null && `${plan.vcpu} vCPU`,
    plan.ramMb != null && `${plan.ramMb / 1024} GB RAM`,
    plan.storageGb != null && `${plan.storageGb} GB storage`,
].filter(Boolean).join(' · ');

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ purchased?: string }> }) {
    const { purchased } = await searchParams;
    const session = await requireCustomerSession();

    const [subscriptions, transactions, orders, plans, hosting, catalogApps, tiers, idleSubscriptions] = await Promise.all([
        getSubscriptions(session.userId),
        listCustomerTransactions(session.userId),
        db.query.siteOrder.findMany({ where: and(eq(schema.siteOrder.userId, session.userId), ne(schema.siteOrder.status, 'CANCELED')), orderBy: asc(schema.siteOrder.createdAt) }),
        db.query.plan.findMany({ where: eq(schema.plan.isActive, true), with: { currency: true } }),
        controller.sites.list(session.userId).then((result) => result.results).catch(() => null),
        loadCatalogApps(),
        loadPlanTiers(),
        listIdleSubscriptions(session.userId).catch(() => []),
    ]);
    // The same rule that decides whether a new site can use a subscription for free, so the page never promises what the server will refuse.
    const idleIds = new Set(idleSubscriptions.map((subscription) => subscription.id));
    const trialSites = (hosting ?? []).filter((site) => site.trial && !site.trial.expired);
    const sites = new Map((hosting ?? []).map((site) => [site.id, site]));
    const pending = orders.filter((order) => ['DRAFT', 'AWAITING_PAYMENT', 'READY'].includes(order.status));

    // Newest first; a canceled subscription is history, not "your plan".
    const current = subscriptions.filter((subscription) => subscription.status !== 'CANCELED');
    const ended = subscriptions.filter((subscription) => subscription.status === 'CANCELED');
    const discounts = await Promise.all(current.map((subscription) => loadSubscriptionDiscount(subscription.paddleSnapshot)));

    const credits = CREDITS_ENABLED ? await db.query.creditAccount.findMany({ where: eq(schema.creditAccount.userId, session.userId) }) : [];
    const nativeSnapshots = CREDITS_ENABLED ? await db.query.billingProviderRecord.findMany({ where: and(eq(schema.billingProviderRecord.userId, session.userId), eq(schema.billingProviderRecord.kind, 'NATIVE_CREDITS')) }) : [];
    const nativeCredits = nativeSnapshots.flatMap((snapshot) => asList(snapshot.payload).map(asRecord));

    return (
        <div className="mx-auto portal-page">
            <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Subscription</p>
            <h1 className="portal-page-title mt-2">Plan and billing</h1>
            <p className="mt-2 portal-text-body text-muted-foreground">Your plans, renewals and invoices. Each paid site has its own subscription.</p>

            {purchased ? <Notice tone="success" className="mt-6">Your plan is now active.</Notice> : null}

            {pending.length > 0 && (
                <section className="mt-6 space-y-3" aria-label="Setups in progress">
                    {pending.map((order) => {
                        const summary = asRecord(order.summary);
                        const paid = order.status === 'READY';
                        return (
                            <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold">{asString(summary.slug) ?? 'New site'} · {asString(summary.planName) ?? 'plan'}</p>
                                        <p className="portal-text-caption text-muted-foreground">
                                            {paid ? 'Payment confirmed. Your site is being set up.' : order.trialDays ? 'Waiting for you to start your free trial.' : 'Waiting for payment. Your details are saved and you will not be charged twice.'}
                                        </p>
                                    </div>
                                </div>
                                <Button asChild size="sm" variant={paid ? 'outline' : 'default'}>
                                    <Link href={`/dashboard/sites/orders/${order.id}`}>{paid ? 'View progress' : 'Resume'}<ArrowRight className="size-4" /></Link>
                                </Button>
                            </div>
                        );
                    })}
                </section>
            )}

            {trialSites.length > 0 && (
                <section className="mt-6 space-y-3" aria-label="Free trials">
                    {trialSites.map((site) => (
                        <div key={site.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                <div>
                                    <p className="font-semibold">{site.name} · free trial</p>
                                    <p className="portal-text-caption text-muted-foreground">{site.trial!.days_left} day{site.trial!.days_left === 1 ? '' : 's'} left. Subscribe before it ends to keep the site running; your data is kept either way.</p>
                                </div>
                            </div>
                            <Button asChild size="sm"><Link href="/dashboard/plans">See plans<ArrowRight className="size-4" /></Link></Button>
                        </div>
                    ))}
                </section>
            )}

            {CREDITS_ENABLED && nativeCredits.length ? <section className="mt-6 rounded-xl border border-border p-5">
                <h2>Billing credits</h2>
                {nativeCredits.map((credit, index) => {
                    const currency = asString(credit.currency_code) ?? 'USD';
                    const available = asString(asRecord(credit.balance).available) ?? '0';
                    return <p key={index}>{new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(available) / 10 ** currencyDigits(currency))} available</p>;
                })}
            </section> : null}
            {CREDITS_ENABLED && credits.length ? <section className="mt-6 rounded-xl border border-border p-5">
                <h2>Assigned credits</h2>
                {credits.map((credit) => <p key={credit.id}>{new Intl.NumberFormat('en', { style: 'currency', currency: credit.currency }).format(credit.available / 10 ** currencyDigits(credit.currency))} available</p>)}
            </section> : null}
            {CREDITS_ENABLED ? <CustomerCreditHistory userId={session.userId} /> : null}

            {current.length === 0 ? (
                <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-card text-center">
                    <Store className="size-8 text-muted-foreground/50" />
                    <h2 className="mt-4 text-xl text-foreground">{pending.length ? 'Finish setting up your site' : trialSites.length ? 'You are on a free trial' : 'No active subscription'}</h2>
                    <p className="mt-2 max-w-sm portal-text-body text-muted-foreground">
                        {pending.length ? 'Complete the payment above to activate your plan.' : 'Choose a plan and create your first site to get started.'}
                    </p>
                    {!pending.length && <Button asChild className="mt-4"><Link href="/dashboard/plans">View plans<ArrowRight className="size-4" /></Link></Button>}
                </section>
            ) : (
                <div className="mt-8 space-y-5">
                    {current.map((subscription, index) => {
                        const plan = subscription.plan;
                        const site = subscription.siteId ? sites.get(subscription.siteId) : undefined;
                        const siteGone = Boolean(subscription.siteId) && hosting !== null && !site;
                        const idle = idleIds.has(subscription.id);
                        const discount = describeDiscount(discounts[index], formatMinorAmount);
                        const view = describeSubscription({
                            status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, currentPeriodEnd: subscription.currentPeriodEnd,
                            graceEndsAt: subscription.graceEndsAt, canceledAt: subscription.canceledAt, billedOnline: Boolean(subscription.paddleSubscriptionId),
                            planName: plan.name, price: `${formatPlanPrice(plan)}`, discount, idle,
                        });
                        const upgrades: UpgradeChoice[] = plans
                            .filter((candidate) => candidate.productId === plan.productId && candidate.id !== plan.id && candidate.paddlePriceId && candidate.priceAmount != null
                                && plan.priceAmount != null && candidate.priceAmount > plan.priceAmount && candidate.currencyId === plan.currencyId && candidate.priceUnit === plan.priceUnit)
                            .sort((a, b) => (a.priceAmount ?? 0) - (b.priceAmount ?? 0))
                            .map((candidate) => ({ id: candidate.id, name: candidate.name, price: formatPlanPrice(candidate), specs: specs(candidate) }));
                        const actionProps = {
                            subscriptionId: subscription.id, siteId: site?.id ?? null, siteName: site?.name ?? null, planId: plan.id, planName: plan.name,
                            endsOn: subscription.currentPeriodEnd ? date(subscription.currentPeriodEnd) : null,
                            canUpgrade: view.canUpgrade, canCancel: view.canCancel, canResume: view.canResume,
                            canUpdatePayment: view.canUpdatePayment, canCreateSite: view.canCreateSite, endsImmediately: subscription.status === 'PAST_DUE', upgrades,
                        };
                        const tier = tiers.find((candidate) => candidate.id === plan.id);
                        const planApps = tier ? splitAppsForPlan(catalogApps, tier, tiers) : null;
                        return (
                            <article key={subscription.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-2xl text-foreground">{plan.name}</h2>
                                            <Badge variant={view.tone}>{view.label}</Badge>
                                        </div>
                                        {plan.tagline ? <p className="mt-1 portal-text-body text-muted-foreground">{plan.tagline}</p> : null}
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-2xl font-semibold tabular-nums">{formatPlanPrice(plan)}</p>
                                        {discount && view.state === 'active' ? <p className="portal-text-caption font-semibold text-success">{discount}</p> : null}
                                    </div>
                                </div>

                                <p className={`mx-5 rounded-lg px-4 py-3 portal-text-body sm:mx-6 ${view.tone === 'error' ? 'bg-destructive/10 text-destructive' : view.tone === 'warning' ? 'bg-warning/10 text-foreground' : 'bg-muted/60 text-foreground/80'}`}>
                                    {view.message}
                                </p>

                                <dl className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
                                    <div className="rounded-lg border border-border/70 p-3">
                                        <dt className="flex items-center gap-2 portal-text-caption text-muted-foreground"><Globe className="size-4" />Site</dt>
                                        <dd className="mt-1 portal-text-body font-semibold">
                                            {site ? <Link href={`/dashboard/sites/${site.id}`} className="underline-offset-2 hover:underline">{site.name}</Link>
                                                : idle ? <span className="text-muted-foreground">{siteGone ? 'Site deleted: ready to reuse' : 'None yet'}</span>
                                                    : <span className="text-muted-foreground">Being set up</span>}
                                        </dd>
                                    </div>
                                    <div className="rounded-lg border border-border/70 p-3">
                                        <dt className="flex items-center gap-2 portal-text-caption text-muted-foreground"><CalendarDays className="size-4" />{subscription.cancelAtPeriodEnd ? 'Ends on' : 'Next renewal'}</dt>
                                        <dd className="mt-1 portal-text-body font-semibold">{date(subscription.currentPeriodEnd)}</dd>
                                    </div>
                                    <div className="rounded-lg border border-border/70 p-3">
                                        <dt className="portal-text-caption text-muted-foreground">Included</dt>
                                        <dd className="mt-1 portal-text-body font-semibold">{specs(plan)}</dd>
                                    </div>
                                </dl>

                                {planApps && (planApps.compatible.length > 0 || planApps.locked.length > 0) && (
                                    <SubscriptionApps
                                        planName={plan.name}
                                        compatible={planApps.compatible.map((app) => ({ id: app.id, name: app.name, price: appPriceLabel(app) }))}
                                        locked={planApps.locked.map((app) => ({ id: app.id, name: app.name, price: appPriceLabel(app), requiredPlanId: app.requiredPlanId, requiredPlanName: app.requiredPlanName }))}
                                        actions={actionProps}
                                    />
                                )}

                                <div className="border-t border-border/70 bg-muted/30 p-5 sm:px-6">
                                    <SubscriptionActions {...actionProps} />
                                    {CREDITS_ENABLED && subscription.paddleSubscriptionId ? <RenewalCreditControls subscriptionId={subscription.id} /> : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <section className="mt-10" aria-labelledby="history">
                <div className="flex items-center gap-2">
                    <Receipt className="size-5 text-muted-foreground" />
                    <h2 id="history" className="text-lg text-foreground">Transaction history</h2>
                </div>
                {transactions.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-input p-6 text-center portal-text-body text-muted-foreground">No payments yet. They will appear here, each with its invoice.</p>
                ) : (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border">
                        <div className="hidden grid-cols-[1.1fr_2fr_1fr_1fr_.4fr] gap-3 border-b border-border bg-muted/50 px-4 py-2 portal-text-caption font-semibold text-muted-foreground md:grid">
                            <span>Date</span><span>Plan</span><span>Amount</span><span>Status</span><span className="text-right">Invoice</span>
                        </div>
                        {transactions.map((row) => (
                            <Link key={row.id} href={`/dashboard/subscription/invoices/${row.id}`}
                                className="grid gap-1 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/40 md:grid-cols-[1.1fr_2fr_1fr_1fr_.4fr] md:items-center md:gap-3">
                                <span className="portal-text-body">{when(row.date)}</span>
                                <span className="min-w-0"><span className="block truncate portal-text-body font-medium">{row.description}</span><span className="block truncate font-mono portal-text-caption text-muted-foreground">{row.reference}</span></span>
                                <span className="portal-text-body font-semibold tabular-nums">{new Intl.NumberFormat('en', { style: 'currency', currency: row.currency }).format(row.amount)}</span>
                                <span><Badge variant={row.variant}>{row.label}</Badge></span>
                                <span className="portal-text-caption font-semibold text-primary md:text-right">View<ArrowRight className="ml-1 inline size-3.5" /></span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {ended.length > 0 && (
                <section className="mt-10" aria-label="Past subscriptions">
                    <h2 className="text-lg text-foreground">Past subscriptions</h2>
                    <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
                        {ended.map((subscription) => (
                            <li key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 portal-text-body">
                                <span className="font-medium">{subscription.plan.name}</span>
                                <span className="text-muted-foreground">Ended {date(subscription.canceledAt ?? subscription.currentPeriodEnd)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
