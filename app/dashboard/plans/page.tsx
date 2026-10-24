import Link from 'next/link';
import { Check, MessageCircle } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { getSubscriptions } from '@/app/customer/actions';
import { PlanCheckoutButton } from '@/components/customer/plan-checkout-button';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { trialDaysFor, trialEligibility } from '@/lib/site-trials';
import { listIdleSubscriptions } from '@/lib/subscription-claims';
import { appPriceLabel, loadCatalogApps, splitAppsForPlan } from '@/lib/plan-apps';
import { loadPlanTiers } from '@/lib/app-plan-access';

export default async function PurchasePlansPage() {
  const session = await requireCustomerSession();

  const [catalogApps, tiers] = await Promise.all([loadCatalogApps(), loadPlanTiers()]);
  const [plans, subscriptions, eligibility, idle] = await Promise.all([
    db.query.plan.findMany({
      where: eq(schema.plan.isActive, true),
      with: { product: true, currency: true },
    }).then((rows) => rows.sort((a, b) => a.product.sortOrder - b.product.sortOrder || a.sortOrder - b.sortOrder)),
    getSubscriptions(session.userId),
    trialEligibility(session.userId),
    listIdleSubscriptions(session.userId).catch(() => []),
  ]);
  // Plans the customer already pays for with no site on them: a new site on one needs no new payment.
  const idlePlanIds = new Set(idle.map((subscription) => subscription.planId));

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
    <div className="portal-page">
      <div className="portal-surface bg-linear-to-br from-primary/5 to-card p-card sm:p-8">
        <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Plans &amp; pricing</p>
        <h1 className="portal-page-title mt-2">Choose a plan</h1>
        <p className="mt-2 portal-text-body text-muted-foreground">Choose a plan for a new site. To upgrade an existing site, open that site and choose Change plan.</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 portal-text-caption text-muted-foreground"><span className="inline-flex items-center gap-2"><Check className="size-4 text-success" />Plans for every stage</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-success" />Clear seat limits</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-success" />Optional add-on apps</span></div>
      </div>

      {[...groups.entries()].map(([product, group]) => {
        const subscriptionForProduct = subscriptionByProduct.get(product);
        return (
          <section key={product} className="mt-10 first:mt-8">
            <h2 className="mb-4 text-lg text-foreground">{group.label}</h2>
            <div className="plan-grid">
              {group.plans.map((plan) => {
                const isCurrent = plan.product.slug !== 'algosuite' && subscriptionForProduct?.planId === plan.id && subscriptionForProduct.status !== 'CANCELED';
                const isAlgoSuite = plan.product.slug === 'algosuite';
                const isTrialOnly = isAlgoSuite && plan.priceAmount == null && Boolean(plan.trialDays);
                const trialDays = isAlgoSuite ? trialDaysFor(plan, eligibility) : 0;
                const isCustomQuote = plan.priceAmount == null && !isTrialOnly;
                const transactionFee = formatTransactionFee(plan.transactionFeePercent);

                return (
                  <div
                    key={plan.id}
                    className={`plan-card ${isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>{isCurrent ? <span className="rounded-full bg-primary/10 px-2.5 py-1 portal-text-caption font-medium text-primary">Your plan</span> : null}</div>
                    {plan.tagline ? <p className="mt-1 portal-text-body text-muted-foreground">{plan.tagline}</p> : null}
                    <div className="mt-5 border-t border-border pt-5">
                      <span className="text-2xl font-bold text-foreground">{isTrialOnly ? `Free for ${plan.trialDays} days` : formatPlanPrice(plan)}</span>
                    </div>
                    {trialDays > 0 && !isTrialOnly && !isCurrent ? <p className="mt-1 portal-text-caption font-medium text-success">{trialDays}-day free trial when you create a site on this plan</p> : null}
                    {idlePlanIds.has(plan.id) ? <p className="mt-1 portal-text-caption font-medium text-success">Included in your subscription: no payment needed for a new site</p> : null}
                    {transactionFee ? <p className="mt-1 portal-text-caption text-muted-foreground">+ {transactionFee}</p> : null}
                    <p className="mt-1 portal-text-caption text-muted-foreground">{plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seat${plan.userLimit === 1 ? "" : "s"}`}</p>

                    {plan.features.length ? (
                      <ul className="mt-5 space-y-3 portal-text-body text-muted-foreground">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>
                        ))}
                      </ul>
                    ) : null}

                    {isAlgoSuite && catalogApps.length > 0 ? (() => {
                      const tier = tiers.find((candidate) => candidate.id === plan.id);
                      if (!tier) return null;
                      const { compatible, locked } = splitAppsForPlan(catalogApps, tier, tiers);
                      return (
                        <div className="mt-5 border-t border-border/60 pt-4">
                          <p className="portal-text-caption font-semibold text-foreground">Compatible apps</p>
                          {compatible.length === 0 ? <p className="mt-1 portal-text-caption text-muted-foreground">No add-on apps yet.</p> : (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {compatible.slice(0, 8).map((app) => (
                                <li key={app.id} className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 portal-text-caption" title={appPriceLabel(app)}>{app.name}</li>
                              ))}
                              {compatible.length > 8 ? <li className="px-1 py-0.5 portal-text-caption text-muted-foreground">+{compatible.length - 8} more</li> : null}
                            </ul>
                          )}
                          {locked.length > 0 ? <p className="mt-2 portal-text-caption text-muted-foreground">{locked.length} more {locked.length === 1 ? 'app needs' : 'apps need'} a higher plan: {locked.slice(0, 3).map((app) => `${app.name} (${app.requiredPlanName})`).join(', ')}{locked.length > 3 ? '…' : ''}</p> : null}
                        </div>
                      );
                    })() : null}

                    <div className="mt-auto pt-6">
                      {isCurrent ? (
                        <Button type="button" disabled className="w-full rounded-md">
                          Current plan
                        </Button>
                      ) : isTrialOnly ? (
                        trialDays > 0 ? (
                          <Button asChild type="button" className="w-full rounded-md"><Link href={`/dashboard/sites/new?plan=${plan.id}`}>Start free trial</Link></Button>
                        ) : (
                          <Button type="button" disabled className="w-full rounded-md">Free trial already used</Button>
                        )
                      ) : isCustomQuote ? (
                        <Button asChild type="button" variant="outline" className="w-full gap-1.5 rounded-md"><Link href="/#contact">
                          <MessageCircle className="h-4 w-4" />Contact sales
                        </Link></Button>
                      ) : isAlgoSuite ? (
                        <Button asChild className="w-full rounded-md"><Link href={`/dashboard/sites/new?plan=${plan.id}`}>{idlePlanIds.has(plan.id) ? 'Create a site with this plan' : 'Choose plan'}</Link></Button>
                      ) : (
                        <PlanCheckoutButton
                          planId={plan.id}
                          label={subscriptionForProduct && subscriptionForProduct.status !== 'CANCELED' ? 'Switch to this plan' : 'Choose plan'}
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
