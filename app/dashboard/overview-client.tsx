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
import type { AddOn, Plan, SubscriptionStatus } from '@prisma/client';
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
    plan: Plan;
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
        <div className="mx-auto max-w-7xl">
            <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">
                    Dashboard
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
                    Welcome back, {profile.firstName}.
                </h1>
                <p className="mt-2 text-sm text-ink-500">
                    Your account and subscriptions at a glance.
                </p>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        className="rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400"
                    >
                        <p className="text-sm text-ink-500">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold">
                            {item.value}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand">
                            View details <ArrowRight className="size-2" />
                        </span>
                    </Link>
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[.78fr_1.22fr]">
                <section className="rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-ink-900">
                            Customer profile
                        </h2>
                        <UserRound className="size-4 text-ink-300" />
                    </div>
                    <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                        <span className="flex h-18 w-18 items-center justify-center rounded-xl bg-ink-950 text-xl font-bold text-white">
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xl font-bold text-ink-950">
                                {profile.firstName} {profile.lastName}
                            </p>
                            <p className="mt-1 flex items-center gap-2 break-all text-sm text-ink-500">
                                <Mail className="size-4 shrink-0" />
                                {profile.email}
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
                                <CheckCircle2 className="size-3.5" />
                                Email verified
                            </span>
                        </div>
                    </div>
                    {/* <Link
                        href="/dashboard/settings"
                        className="mt-6 flex h-8 items-center justify-center gap-2 rounded-full border border-ink-200 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                    >
                        Manage profile
                        <ArrowRight className="h-4 w-4" />
                    </Link> */}
                    <Button asChild className="mt-6">
                        <Link href="/dashboard/settings">
                            Manage profile
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                </section>

                {subscriptions.length > 0 ? (
                    <div className="space-y-4">
                        {subscriptions.map((subscription) => {
                            const monthlyTotal = computeMonthlyTotal(
                                subscription.plan,
                                subscription.addOns,
                            );
                            return (
                                <section
                                    key={subscription.plan.productId}
                                    className="relative overflow-hidden rounded-xl bg-ink-950 p-4 text-white sm:p-6"
                                >
                                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-[80px]" />
                                    <div className="relative">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <span className="inline-flex rounded-full bg-brand px-2 py-1 text-xs font-semibold">
                                                    {subscription.status ===
                                                        'ACTIVE'
                                                        ? 'Active'
                                                        : subscription.status}
                                                </span>
                                                <h2 className="mt-4 text-2xl font-bold">
                                                    {subscription.plan.name}{' '}
                                                    plan
                                                </h2>
                                                <p className="mt-1 text-sm text-white/45">
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
                                                    <p className="text-xs text-white/35">
                                                        {formatCurrency(
                                                            monthlyTotal,
                                                        )}
                                                        /mo with add-ons
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="my-4 h-px bg-white/10" />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="rounded-lg bg-white/[.06] p-4">
                                                <p className="flex items-center gap-2 text-xs text-white/40">
                                                    <Package className="size-4" />
                                                    Add-ons attached
                                                </p>
                                                <p className="mt-2 text-sm font-semibold">
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
                                            <div className="rounded-lg bg-white/[.06] p-4">
                                                <p className="flex items-center gap-2 text-xs text-white/40">
                                                    <CalendarDays className="size-4" />
                                                    Next billing date
                                                </p>
                                                <p className="mt-2 text-sm font-semibold">
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
                                            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white"
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
                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white text-sm font-semibold text-ink-600 hover:bg-ink-50"
                        >
                            Add another product
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                ) : (
                    <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-6 text-center">
                        <Store className="size-8 text-ink-300" />
                        <h2 className="mt-4 text-xl font-bold text-ink-900">
                            No active subscription
                        </h2>
                        <p className="mt-2 max-w-sm text-sm text-ink-500">
                            Choose a plan to set up your subscription.
                        </p>
                        <Button asChild className='py-2'>
                            <Link href="/dashboard/plans" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white">View plans<ArrowRight className="size-4" /></Link>
                        </Button>
                    </section>
                )}
            </div>

            {allAddOns.length > 0 ? (
                <section className="mt-6 overflow-hidden rounded-xl border border-ink-200 bg-white">
                    <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand">
                                <CreditCard className="size-4" />
                            </span>
                            <div>
                                <h2 className="font-bold text-ink-900">
                                    Your add-ons
                                </h2>
                                <p className="text-xs text-ink-400">
                                    Attached across your subscriptions
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/subscription"
                            className="text-xs font-semibold text-link hover:underline"
                        >
                            Manage add-ons
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[560px]">
                            {allAddOns.map(({ addOn, product }) => (
                                <div
                                    key={addOn.id}
                                    className="grid grid-cols-[1.5fr_1fr_1fr] items-center gap-4 border-b border-ink-100 px-6 py-4 last:border-0"
                                >
                                    <p className="text-sm font-semibold text-ink-800">
                                        {addOn.name}
                                    </p>
                                    <p className="text-xs text-ink-400">
                                        {formatProductName(product)}
                                    </p>
                                    <p className="text-sm text-ink-500">
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
