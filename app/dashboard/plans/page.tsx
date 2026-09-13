import Link from 'next/link';
import { Check, MessageCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { getSubscriptions } from '@/app/customer/actions';
import { PlanCheckoutButton } from '@/components/customer/plan-checkout-button';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';


export default async function PurchasePlansPage() {
  const session = await requireCustomerSession();

  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: [{ product: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    }),
    getSubscriptions(session.userId),
  ]);

  // Products are rows now, so the grouping key is the product id and the
  // heading comes from the row's own label rather than a hard-coded map.
  type PlanWithProduct = (typeof plans)[number];
  const groups = new Map<string, { label: string; plans: PlanWithProduct[] }>();
  for (const plan of plans) {
    const group = groups.get(plan.productId)
      ?? { label: plan.product.label, plans: [] as PlanWithProduct[] };
    group.plans.push(plan);
    groups.set(plan.productId, group);
  }

  const subscriptionByProduct = new Map(subscriptions.map((subscription) => [subscription.productId, subscription]));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Plans</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Choose a plan</h1>
      <p className="mt-2 text-sm text-ink-500">You can hold one plan per product — pick a plan for each product you want to subscribe to.</p>

      {[...groups.entries()].map(([product, group]) => {
        const subscriptionForProduct = subscriptionByProduct.get(product);
        return (
        <section key={product} className="mt-10 first:mt-8">
          <h2 className="mb-4 text-lg font-bold text-ink-900">{group.label}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.plans.map((plan) => {
              const isCurrent = subscriptionForProduct?.planId === plan.id;
              const isCustomQuote = plan.priceAmount == null;
              const transactionFee = formatTransactionFee(plan.transactionFeePercent);

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-xl border p-6 ${isCurrent ? 'border-brand ring-1 ring-brand' : 'border-ink-200'} bg-white`}
                >
                  <h3 className="text-lg font-bold text-ink-950">{plan.name}</h3>
                  {plan.tagline ? <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p> : null}
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-ink-950">{formatPlanPrice(plan)}</span>
                  </div>
                  {transactionFee ? <p className="mt-1 text-xs text-ink-400">+ {transactionFee}</p> : null}
                  <p className="mt-1 text-xs text-ink-400">{plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}</p>

                  {plan.features.length ? (
                    <ul className="mt-5 space-y-2 text-sm text-ink-600">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{feature}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button type="button" disabled className="w-full rounded-md">
                        Current plan
                      </Button>
                    ) : isCustomQuote ? (
                      <Link href="/#contact">
                        <Button type="button" variant="outline" className="w-full gap-1.5 rounded-md">
                          <MessageCircle className="h-4 w-4" />Contact sales
                        </Button>
                      </Link>
                    ) : (
                      <PlanCheckoutButton
                        planId={plan.id}
                        label={subscriptionForProduct ? 'Switch to this plan' : 'Choose plan'}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        );
      })}

      {plans.length === 0 ? <p className="mt-10 text-center text-sm text-ink-500">No plans are available yet — check back soon.</p> : null}
    </div>
  );
}
