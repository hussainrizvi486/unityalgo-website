import Link from 'next/link';
import { Notice } from '@/components/ui/notice';
import { ArrowRight, CalendarDays, Check, Package, PlusCircle, Store, Users, X } from 'lucide-react';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AddOn, Currency, Plan, Subscription, SubscriptionAddOn } from '@/db/types';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { getSubscriptions, addSubscriptionAddOnAction, removeSubscriptionAddOnAction } from '@/app/customer/actions';
import { computeMonthlyTotal, formatAddOnPrice, formatCurrency, formatPlanPrice, formatProductName, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

interface SubscriptionPageProps {
  searchParams: Promise<{ purchased?: string }>;
}

type SubscriptionWithRelations = Subscription & { plan: Plan & { currency: Currency | null }; addOns: (SubscriptionAddOn & { addOn: AddOn })[] };

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const { purchased } = await searchParams;
  const session = await requireCustomerSession();

  const subscriptions = await getSubscriptions(session.userId);

  const productIds = [...new Set(subscriptions.map((s) => s.plan.productId))];
  const attachedIds = new Set(subscriptions.flatMap((s) => s.addOns.map((row) => row.addOnId)));
  const addOnsByProduct = new Map<string, AddOn[]>();
  if (productIds.length > 0) {
    const rows = await db.query.addOn.findMany({
      where: and(inArray(schema.addOn.productId, productIds), eq(schema.addOn.isActive, true)),
      orderBy: asc(schema.addOn.sortOrder),
    });
    for (const addOn of rows) {
      if (attachedIds.has(addOn.id)) continue;
      const bucket = addOnsByProduct.get(addOn.productId) ?? [];
      bucket.push(addOn);
      addOnsByProduct.set(addOn.productId, bucket);
    }
  }

  return (
    <div className="mx-auto portal-page">
      <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Subscription</p>
      <h1 className="portal-page-title mt-2">Plan and billing</h1>
      <p className="mt-2 portal-text-body text-muted-foreground">Manage your plans and add-ons — you can hold one plan per product at a time.</p>

      {purchased ? (
        <Notice tone="success" className="mt-6">Your plan is now active.</Notice>
      ) : null}

      {subscriptions.length === 0 ? (
        <section className="mt-8 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-card text-center">
          <Store className="size-8 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl text-foreground">No active subscription</h2>
          <p className="mt-2 max-w-sm portal-text-body text-muted-foreground">Choose a plan to activate your subscription.</p>
          <Button asChild className='py-2'>
            <Button asChild className="mt-4">
              <Link href="/dashboard/plans">View plans<ArrowRight className="size-4" /></Link>
            </Button>
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
      <h2 className="mb-3 portal-text-caption uppercase tracking-eyebrow text-muted-foreground">{formatProductName(subscription.plan.productId)}</h2>

      <section className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-primary px-3 py-1 portal-text-caption font-semibold">{subscription.status === 'ACTIVE' ? 'Active' : subscription.status}</span>
              <h3 className="mt-4 text-3xl ">{subscription.plan.name} plan</h3>
              {subscription.plan.tagline ? <p className="mt-1 portal-text-body text-primary-foreground/45">{subscription.plan.tagline}</p> : null}
            </div>
            <div className="sm:text-right">
              <strong className="text-2xl sm:text-3xl">{formatPlanPrice(subscription.plan)}</strong>
              {transactionFee ? <p className="portal-text-caption text-primary-foreground/35">+ {transactionFee}</p> : null}
            </div>
          </div>
          <div className="my-6 h-px bg-primary-foreground/10" />
          <div className="grid gap-gap sm:grid-cols-2">
            <div className="rounded-lg bg-card/[.06] p-4">
              <p className="flex items-center gap-2 portal-text-caption text-primary-foreground/40"><Users className="h-4 w-4" />Seats</p>
              <p className="mt-2 portal-text-body font-semibold">{subscription.plan.userLimit == null ? 'Unlimited' : `Up to ${subscription.plan.userLimit}`}</p>
            </div>
            <div className="rounded-lg bg-card/[.06] p-4">
              <p className="flex items-center gap-2 portal-text-caption text-primary-foreground/40"><CalendarDays className="h-4 w-4" />Next renewal</p>
              <p className="mt-2 portal-text-body font-semibold">
                {subscription.currentPeriodEnd ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(subscription.currentPeriodEnd) : '—'}
              </p>
            </div>
          </div>
          {subscription.plan.features.length ? (
            <div className="mt-6 space-y-2 portal-text-body text-primary-foreground/70">
              {subscription.plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary-foreground" />{feature}</div>
              ))}
            </div>
          ) : null}
          <Link href="/dashboard/plans" className="mt-6 inline-flex items-center gap-2 portal-text-body font-semibold text-primary-foreground">Change plan<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="mt-4 overflow-hidden portal-surface">
        <div className="flex items-center gap-3 border-b border-border/60 p-5 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><Package className="h-4 w-4" /></span>
          <div><h3 className=" text-foreground">Your add-ons</h3><p className="portal-text-caption text-muted-foreground">Currently attached to this subscription</p></div>
        </div>
        {subscription.addOns.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center p-6 portal-text-body text-muted-foreground">No add-ons added yet.</p>
        ) : (
          <div>
            {subscription.addOns.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-gap border-b border-border/60 px-6 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="truncate portal-text-body font-semibold text-foreground">{row.addOn.name}</p>
                  {row.addOn.description ? <p className="mt-0.5 truncate portal-text-caption text-muted-foreground">{row.addOn.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-gap">
                  <span className="portal-text-body font-semibold text-foreground/80">{formatAddOnPrice(row.addOn)}</span>
                  <form action={removeSubscriptionAddOnAction}>
                    <input type="hidden" name="addOnId" value={row.addOnId} />
                    <Button type="submit" size="sm" variant="outline" className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-3.5 w-3.5" />Remove
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 overflow-hidden portal-surface">
        <div className="border-b border-border/60 p-5 sm:p-6">
          <h3 className=" text-foreground">Available add-ons</h3>
          <p className="portal-text-caption text-muted-foreground">Add extra features or items to this {formatProductName(subscription.plan.productId)} subscription</p>
        </div>
        {availableAddOns.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center p-6 portal-text-body text-muted-foreground">No more add-ons available for this plan right now.</p>
        ) : (
          <div>
            {availableAddOns.map((addOn) => (
              <div key={addOn.id} className="flex items-center justify-between gap-gap border-b border-border/60 px-6 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="truncate portal-text-body font-semibold text-foreground">{addOn.name}</p>
                  {addOn.description ? <p className="mt-0.5 truncate portal-text-caption text-muted-foreground">{addOn.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-gap">
                  <span className="portal-text-body font-semibold text-foreground/80">{formatAddOnPrice(addOn)}</span>
                  <form action={addSubscriptionAddOnAction}>
                    <input type="hidden" name="addOnId" value={addOn.id} />
                    <Button type="submit" size="sm" className="gap-1.5">
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
        <p className="mt-4 text-right portal-text-body text-muted-foreground">
          Estimated monthly total: <strong className="text-foreground">{formatCurrency(monthlyTotal, subscription.plan.currency)}/mo</strong>
        </p>
      ) : null}
    </div>
  );
}
