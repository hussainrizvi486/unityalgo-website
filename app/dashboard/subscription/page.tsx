import Link from 'next/link';
import { Notice } from '@/components/ui/notice';
import { ArrowRight, CalendarDays, Check, Package, PlusCircle, Store, Users, X } from 'lucide-react';
import type { AddOn, Plan, Subscription, SubscriptionAddOn } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { getSubscriptions, addSubscriptionAddOnAction, removeSubscriptionAddOnAction } from '@/app/customer/actions';
import { computeMonthlyTotal, formatAddOnPrice, formatCurrency, formatPlanPrice, formatProductName, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

interface SubscriptionPageProps {
  searchParams: Promise<{ purchased?: string }>;
}

type SubscriptionWithRelations = Subscription & { plan: Plan; addOns: (SubscriptionAddOn & { addOn: AddOn })[] };

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const { purchased } = await searchParams;
  const session = await requireCustomerSession();

  const subscriptions = await getSubscriptions(session.userId);

  // One query for every product's add-ons, not one per subscription. The old
  // shape ran a findMany inside the render loop, so a customer with two
  // subscriptions issued two extra round trips to render one page.
  const productIds = [...new Set(subscriptions.map((s) => s.plan.productId))];
  const attachedIds = new Set(subscriptions.flatMap((s) => s.addOns.map((row) => row.addOnId)));
  const addOnsByProduct = new Map<string, AddOn[]>();
  if (productIds.length > 0) {
    const rows = await prisma.addOn.findMany({
      where: { productId: { in: productIds }, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    for (const addOn of rows) {
      if (attachedIds.has(addOn.id)) continue;
      const bucket = addOnsByProduct.get(addOn.productId) ?? [];
      bucket.push(addOn);
      addOnsByProduct.set(addOn.productId, bucket);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Subscription</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Plan and billing</h1>
      <p className="mt-2 text-sm text-ink-500">Manage your plans and add-ons — you can hold one plan per product at a time.</p>

      {purchased ? (
        <Notice tone="success" className="mt-6">Your plan is now active.</Notice>
      ) : null}

      {subscriptions.length === 0 ? (
        <section className="mt-8 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-6 text-center">
          <Store className="size-8 text-ink-300" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">No active subscription</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-500">Choose a plan to activate your subscription.</p>
          <Button asChild className='py-2'>
            <Link href="/dashboard/plans" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white">View plans<ArrowRight className="size-4" /></Link>
          </Button>
        </section>
      ) : (
        <div className="mt-8 space-y-10">
          {subscriptions.map((subscription) => (
            <SubscriptionBlock
              key={subscription.id}
              subscription={subscription}
              availableAddOns={addOnsByProduct.get(subscription.plan.productId) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionBlock({ subscription, availableAddOns }: { subscription: SubscriptionWithRelations; availableAddOns: AddOn[] }) {
  const monthlyTotal = computeMonthlyTotal(subscription.plan, subscription.addOns.map((row) => row.addOn));
  const transactionFee = formatTransactionFee(subscription.plan.transactionFeePercent);

  return (
    <div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-ink-400">{formatProductName(subscription.plan.productId)}</h2>

      <section className="relative overflow-hidden rounded-xl bg-ink-950 p-6 text-white sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-[80px]" />
        <div className="relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold">{subscription.status === 'ACTIVE' ? 'Active' : subscription.status}</span>
              <h3 className="mt-4 text-3xl font-bold">{subscription.plan.name} plan</h3>
              {subscription.plan.tagline ? <p className="mt-1 text-sm text-white/45">{subscription.plan.tagline}</p> : null}
            </div>
            <div className="sm:text-right">
              <strong className="text-2xl sm:text-3xl">{formatPlanPrice(subscription.plan)}</strong>
              {transactionFee ? <p className="text-xs text-white/35">+ {transactionFee}</p> : null}
            </div>
          </div>
          <div className="my-6 h-px bg-white/10" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-white/[.06] p-4">
              <p className="flex items-center gap-2 text-xs text-white/40"><Users className="h-4 w-4" />Seats</p>
              <p className="mt-2 text-sm font-semibold">{subscription.plan.userLimit == null ? 'Unlimited' : `Up to ${subscription.plan.userLimit}`}</p>
            </div>
            <div className="rounded-lg bg-white/[.06] p-4">
              <p className="flex items-center gap-2 text-xs text-white/40"><CalendarDays className="h-4 w-4" />Next renewal</p>
              <p className="mt-2 text-sm font-semibold">
                {subscription.currentPeriodEnd ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(subscription.currentPeriodEnd) : '—'}
              </p>
            </div>
          </div>
          {subscription.plan.features.length ? (
            <div className="mt-6 space-y-2 text-sm text-white/70">
              {subscription.plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-white" />{feature}</div>
              ))}
            </div>
          ) : null}
          <Link href="/dashboard/plans" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">Change plan<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="flex items-center gap-3 border-b border-ink-100 p-5 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand"><Package className="h-4 w-4" /></span>
          <div><h3 className="font-bold text-ink-900">Your add-ons</h3><p className="text-xs text-ink-400">Currently attached to this subscription</p></div>
        </div>
        {subscription.addOns.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center p-6 text-sm text-ink-400">No add-ons added yet.</p>
        ) : (
          <div>
            {subscription.addOns.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 border-b border-ink-100 px-6 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{row.addOn.name}</p>
                  {row.addOn.description ? <p className="mt-0.5 truncate text-xs text-ink-400">{row.addOn.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-semibold text-ink-700">{formatAddOnPrice(row.addOn)}</span>
                  <form action={removeSubscriptionAddOnAction}>
                    <input type="hidden" name="addOnId" value={row.addOnId} />
                    <Button type="submit" size="sm" variant="outline" className="gap-1.5 text-ink-500 hover:bg-error-50 hover:text-error-700">
                      <X className="h-3.5 w-3.5" />Remove
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-100 p-5 sm:p-6">
          <h3 className="font-bold text-ink-900">Available add-ons</h3>
          <p className="text-xs text-ink-400">Add extra features or items to this {formatProductName(subscription.plan.productId)} subscription</p>
        </div>
        {availableAddOns.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center p-6 text-sm text-ink-400">No more add-ons available for this plan right now.</p>
        ) : (
          <div>
            {availableAddOns.map((addOn) => (
              <div key={addOn.id} className="flex items-center justify-between gap-4 border-b border-ink-100 px-6 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{addOn.name}</p>
                  {addOn.description ? <p className="mt-0.5 truncate text-xs text-ink-400">{addOn.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-semibold text-ink-700">{formatAddOnPrice(addOn)}</span>
                  <form action={addSubscriptionAddOnAction}>
                    <input type="hidden" name="addOnId" value={addOn.id} />
                    <Button type="submit" size="sm" className="gap-1.5 bg-ink-900 text-white hover:bg-ink-800">
                      <PlusCircle className="h-3.5 w-3.5" />Add
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {monthlyTotal != null ? (
        <p className="mt-4 text-right text-sm text-ink-500">
          Estimated monthly total: <strong className="text-ink-900">{formatCurrency(monthlyTotal)}/mo</strong>
        </p>
      ) : null}
    </div>
  );
}
