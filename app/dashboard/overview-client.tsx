import Link from 'next/link';
import {
    ArrowRight,
    Bell,
    CalendarDays,
    CreditCard,
    Globe,
    LifeBuoy,
    Package,
    Plus,
    Store,
    Wallet,
} from 'lucide-react';
import type { AddOn, Currency, Plan, SubscriptionStatus } from '@/db/types';
import {
    computeMonthlyTotal,
    formatAddOnPrice,
    formatCurrency,
    formatPlanPrice,
    formatProductName,
} from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/admin-format';

interface Profile {
    firstName: string;
    lastName: string;
    email: string;
}

interface SubscriptionSummary {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    plan: Plan & { currency?: Currency | null };
    addOns: AddOn[];
}

export function OverviewClient({
    profile,
    subscriptions,
    siteStats,
    monthlySpend,
    notifications,
}: {
    profile: Profile;
    subscriptions: SubscriptionSummary[];
    siteStats: { total: number; ready: number; provisioning: number } | null;
    monthlySpend: Array<{ currency: string; amount: number }>;
    notifications: { total: number; unread: number };
}) {
    const allAddOns = subscriptions.flatMap((subscription) =>
        subscription.addOns.map((addOn) => ({
            addOn,
            product: subscription.plan.productId,
        })),
    );

    const today = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date());

    const stats = [
        {
            label: 'AlgoSuite Sites',
            value: siteStats ? siteStats.total.toLocaleString('en-US') : 'Unavailable',
            hint: siteStats
                ? siteStats.total === 0
                    ? 'No sites yet'
                    : `${siteStats.ready} ready${siteStats.provisioning ? ` · ${siteStats.provisioning} installing` : ''}`
                : 'Hosting is offline',
            href: '/dashboard/sites',
            icon: Globe,
            tone: 'bg-primary/10 text-primary',
        },
        {
            label: 'Monthly Spend',
            value: monthlySpend.length ? monthlySpend.map((row) => formatPrice(row.amount, row.currency)).join(' + ') : formatPrice(0),
            hint: monthlySpend.length ? 'Plans, add-ons and paid apps' : 'No active billing',
            href: '/dashboard/subscription',
            icon: Wallet,
            tone: 'bg-success/10 text-success',
        },
        {
            label: 'Notifications',
            value: notifications.total.toLocaleString('en-US'),
            hint: notifications.unread ? `${notifications.unread} unread` : 'All caught up',
            href: null,
            icon: Bell,
            tone: 'bg-warning/10 text-warning',
        },
    ];

    return (
        <div className="mx-auto portal-page">
            <section className="relative overflow-hidden rounded-2xl border border-border bg-linear-to-br from-primary/10 via-card to-card p-5 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative">
                    <p className="inline-flex items-center gap-2 portal-text-caption font-semibold text-muted-foreground">
                        <CalendarDays className="size-4" />
                        {today}
                    </p>
                    <h1 className="portal-page-title mt-3">Welcome aboard!</h1>
                    <p className="mt-2 max-w-xl portal-text-body text-muted-foreground">
                        Hi {profile.firstName}, here is what is happening with your account today.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Button asChild>
                            <Link href="/dashboard/sites/new">
                                <Plus className="size-4" />
                                Create a New Site
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/dashboard/support/new">
                                <LifeBuoy className="size-4" />
                                Create a New Ticket
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <div className="mt-gap grid gap-gap sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((item) => {
                    const body = (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <p className="portal-text-body font-medium text-muted-foreground">{item.label}</p>
                                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                                    <item.icon className="size-5" />
                                </span>
                            </div>
                            <p className="mt-4 truncate text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
                            <p className="mt-1 portal-text-caption text-muted-foreground">{item.hint}</p>
                        </>
                    );
                    return item.href ? (
                        <Link key={item.label} href={item.href} className="p-5 transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-sm portal-surface">
                            {body}
                        </Link>
                    ) : (
                        <div key={item.label} className="p-5 portal-surface">
                            {body}
                        </div>
                    );
                })}
            </div>

            <div className="mt-gap grid gap-gap">
                {subscriptions.length > 0 ? (
                    <div className="space-y-gap">
                        {subscriptions.map((subscription) => {
                            const monthlyTotal = computeMonthlyTotal(
                                subscription.plan,
                                subscription.addOns,
                            );
                            return (
                                <section
                                    key={subscription.plan.productId}
                                    className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground sm:p-6"
                                >
                                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-2xl" />
                                    <div className="relative">
                                        <div className="flex flex-col gap-gap sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <span className="inline-flex rounded-full bg-primary px-2 py-1 portal-text-caption font-semibold">
                                                    {subscription.status ===
                                                        'ACTIVE'
                                                        ? 'Active'
                                                        : subscription.status}
                                                </span>
                                                <h2 className="mt-4 text-2xl ">
                                                    {subscription.plan.name}{' '}
                                                    plan
                                                </h2>
                                                <p className="mt-1 portal-text-body text-primary-foreground/45">
                                                    {formatProductName(
                                                        subscription.plan
                                                            .productId,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="sm:text-right">
                                                <strong className="text-xl sm:text-2xl">
                                                    {formatPlanPrice(
                                                        subscription.plan,
                                                    )}
                                                </strong>
                                                {monthlyTotal != null ? (
                                                    <p className="portal-text-caption text-primary-foreground/35">
                                                        {formatCurrency(
                                                            monthlyTotal,
                                                            subscription.plan.currency,
                                                        )}
                                                        /mo with add-ons
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="my-4 h-px bg-primary-foreground/10" />
                                        <div className="grid gap-gap sm:grid-cols-2">
                                            <div className="rounded-lg bg-card/[.06] p-4">
                                                <p className="flex items-center gap-2 portal-text-caption text-primary-foreground/40">
                                                    <Package className="size-4" />
                                                    Add-ons attached
                                                </p>
                                                <p className="mt-2 portal-text-body font-semibold">
                                                    {subscription.addOns
                                                        .length === 0
                                                        ? 'None'
                                                        : subscription.addOns
                                                            .map(
                                                                (addOn) =>
                                                                    addOn.name,
                                                            )
                                                            .join(', ')}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-card/[.06] p-4">
                                                <p className="flex items-center gap-2 portal-text-caption text-primary-foreground/40">
                                                    <CalendarDays className="size-4" />
                                                    Next billing date
                                                </p>
                                                <p className="mt-2 portal-text-body font-semibold">
                                                    {subscription.currentPeriodEnd
                                                        ? new Intl.DateTimeFormat(
                                                            'en-US',
                                                            {
                                                                dateStyle:
                                                                    'medium',
                                                            },
                                                        ).format(
                                                            subscription.currentPeriodEnd,
                                                        )
                                                        : '—'}
                                                </p>
                                            </div>
                                        </div>
                                        <Link
                                            href="/dashboard/subscription"
                                            className="mt-4 inline-flex items-center gap-2 portal-text-body font-semibold text-primary-foreground"
                                        >
                                            Manage subscription
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </div>
                                </section>
                            );
                        })}
                        <Link
                            href="/dashboard/plans"
                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card portal-text-body font-semibold text-foreground/70 hover:bg-muted"
                        >
                            Add another product
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                ) : (
                    <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-card text-center">
                        <Store className="size-8 text-muted-foreground/50" />
                        <h2 className="mt-4 text-xl text-foreground">
                            No active subscription
                        </h2>
                        <p className="mt-2 max-w-sm portal-text-body text-muted-foreground">
                            Choose a plan to set up your subscription.
                        </p>
                        <Button asChild className='py-2'>
                            <Button asChild className="mt-4">
                                <Link href="/dashboard/plans">View plans<ArrowRight className="size-4" /></Link>
                            </Button>
                        </Button>
                    </section>
                )}
            </div>

            {allAddOns.length > 0 ? (
                <section className="mt-6 overflow-hidden portal-surface">
                    <div className="flex flex-col gap-2 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                                <CreditCard className="size-4" />
                            </span>
                            <div>
                                <h2 className=" text-foreground">
                                    Your add-ons
                                </h2>
                                <p className="portal-text-caption text-muted-foreground">
                                    Attached across your subscriptions
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/subscription"
                            className="portal-text-caption font-semibold text-primary hover:underline"
                        >
                            Manage add-ons
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-140">
                            {allAddOns.map(({ addOn, product }) => (
                                <div
                                    key={addOn.id}
                                    className="grid grid-cols-[1.5fr_1fr_1fr] items-center gap-gap border-b border-border/60 px-6 py-4 last:border-0"
                                >
                                    <p className="portal-text-body font-semibold text-foreground">
                                        {addOn.name}
                                    </p>
                                    <p className="portal-text-caption text-muted-foreground">
                                        {formatProductName(product)}
                                    </p>
                                    <p className="portal-text-body text-muted-foreground">
                                        {formatAddOnPrice(addOn)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
