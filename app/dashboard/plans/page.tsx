import Link from 'next/link';
import { Check, MessageCircle } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { getSubscriptions } from '@/app/customer/actions';
import { PlanCheckoutButton } from '@/components/customer/plan-checkout-button';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';


export default async function PurchasePlansPage() {
  const session = await requireCustomerSession();

  const [plans, subscriptions] = await Promise.all([
    // Drizzle cannot order by a related table's column, so order the (few) rows after fetching.
    db.query.plan.findMany({
      where: eq(schema.plan.isActive, true),
      with: { product: true },
    }).then((rows) => rows.sort((a, b) => a.product.sortOrder - b.product.sortOrder || a.sortOrder - b.sortOrder)),
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
    <div className="mx-auto max-w-wide">
      <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Plans</p>
      <h1 className="portal-page-title mt-2">Choose a plan</h1>
      <p className="mt-2 portal-text-body text-muted-foreground">You can hold one plan per product — pick a plan for each product you want to subscribe to.</p>

      {[...groups.entries()].map(([product, group]) => {
        const subscriptionForProduct = subscriptionByProduct.get(product);
        return (
        <section key={product} className="mt-10 first:mt-8">
          <h2 className="mb-4 text-lg text-foreground">{group.label}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.plans.map((plan) => {
              const isCurrent = subscriptionForProduct?.planId === plan.id;
              const isCustomQuote = plan.priceAmount == null;
              const transactionFee = formatTransactionFee(plan.transactionFeePercent);

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-xl border p-card ${isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'} bg-card`}
                >
                  <h3 className="text-lg text-foreground">{plan.name}</h3>
                  {plan.tagline ? <p className="mt-1 portal-text-body text-muted-foreground">{plan.tagline}</p> : null}
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-foreground">{formatPlanPrice(plan)}</span>
                  </div>
                  {transactionFee ? <p className="mt-1 portal-text-caption text-muted-foreground">+ {transactionFee}</p> : null}
                  <p className="mt-1 portal-text-caption text-muted-foreground">{plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}</p>

                  {plan.features.length ? (
                    <ul className="mt-5 space-y-2 portal-text-body text-foreground/70">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button type="button" disabled className="w-full rounded-md">
                        Current plan
                      </Button>
                    ) : isCustomQuote ? (
                      <Button asChild type="button" variant="outline" className="w-full gap-1.5 rounded-md"><Link href="/#contact">
                          <MessageCircle className="h-4 w-4" />Contact sales
                        </Link></Button>
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

      {plans.length === 0 ? <p className="mt-10 text-center portal-text-body text-muted-foreground">No plans are available yet — check back soon.</p> : null}
    </div>
  );
}
