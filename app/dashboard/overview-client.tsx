import Link from 'next/link';
import {
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    CreditCard,
    Mail,
    Package,
    Store,
    UserRound,
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
    appCount,
}: {
    profile: Profile;
    subscriptions: SubscriptionSummary[];
    siteStats: { total: number; ready: number; provisioning: number } | null;
    appCount: number;
}) {
    const initials =
        `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() ||
        profile.email.charAt(0).toUpperCase();
    const allAddOns = subscriptions.flatMap((subscription) =>
        subscription.addOns.map((addOn) => ({
            addOn,
            product: subscription.plan.productId,
        })),
    );

    return (
        <div className="mx-auto portal-page">
            <div className="mb-8">
                <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">
                    Dashboard
                </p>
                <h1 className="portal-page-title mt-2">
                    Welcome back, {profile.firstName}.
                </h1>
                <p className="mt-2 portal-text-body text-muted-foreground">
                    Your account and subscriptions at a glance.
                </p>
            </div>

            <div className="mb-4 grid gap-gap sm:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        label: 'Your sites',
                        value: siteStats?.total ?? 'Unavailable',
                        href: '/dashboard/sites',
                    },
                    {
                        label: 'Ready to use',
                        value: siteStats?.ready ?? '—',
                        href: '/dashboard/sites',
                    },
                    {
                        label: 'Being installed',
                        value: siteStats?.provisioning ?? '—',
                        href: '/dashboard/sites',
                    },
                    {
                        label: 'Applications',
                        value: appCount,
                        href: '/dashboard/app-store',
                    },
                ].map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className="p-4 transition-colors hover:border-input portal-surface"
                    >
                        <p className="portal-text-body text-muted-foreground">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold">
                            {item.value}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 portal-text-caption text-primary">
                            View details <ArrowRight className="size-2" />
                        </span>
                    </Link>
                ))}
            </div>
            <div className="grid gap-gap-lg xl:grid-cols-[.78fr_1.22fr]">
                <section className="p-4 sm:p-6 portal-surface">
                    <div className="flex items-center justify-between">
                        <h2 className=" text-foreground">
                            Customer profile
                        </h2>
                        <UserRound className="size-4 text-muted-foreground/50" />
                    </div>
                    <div className="mt-6 flex flex-col items-start gap-gap sm:flex-row sm:items-center">
                        <span className="flex h-18 w-18 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xl font-bold text-foreground">
                                {profile.firstName} {profile.lastName}
                            </p>
                            <p className="mt-1 flex items-center gap-2 break-all portal-text-body text-muted-foreground">
                                <Mail className="size-4 shrink-0" />
                                {profile.email}
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 portal-text-small font-semibold text-success">
                                <CheckCircle2 className="size-3.5" />
                                Email verified
                            </span>
                        </div>
                    </div>
                    {}
                    <Button asChild className="mt-6">
                        <Link href="/dashboard/settings">
                            Manage profile
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                </section>

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
