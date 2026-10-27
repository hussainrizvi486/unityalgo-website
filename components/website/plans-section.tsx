import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { listProductsWithPlans, listAlgoSuitePlans } from '@/lib/products';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { PlanComparison } from '@/components/website/plan-comparison';
import { withPlanDetails } from '@/lib/pricing-plans';

export async function PlansSection({ productSlug }: { productSlug?: 'algosuite' } = {}) {
    const products = productSlug === 'algosuite'
        ? [{ id: 'algosuite', slug: 'algosuite', label: 'AlgoSuite', tagline: null, plans: await listAlgoSuitePlans() }]
        : await listProductsWithPlans();
    if (!productSlug && products.length === 0) return null;

    return (
        <section id={productSlug ? "pricing" : "plans"} className="scroll-mt-24 bg-card site-section-spacing">
            <div className="site-container site-gutters">
                <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {productSlug ? 'AlgoSuite pricing' : 'Our products'}
                    </p>
                    <h2 className="mt-3 text-3xl tracking-tight text-foreground md:text-4xl">
                        {productSlug ? 'A plan for your next stage of growth' : 'Software we build, own and sell'}
                    </h2>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                        {productSlug ? 'Compare seats, features, and pricing. Choose the plan that fits your team today, with room to grow.' : 'Explore products we build, operate, and support ourselves.'}
                    </p>
                </div>

                {products.map((product) => (
                    <div key={product.id} className="mt-14 first:mt-12">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-gap gap-y-2 border-b border-border/60 pb-4">
                            <div>
                                <h3 className="text-xl text-foreground">{product.label}</h3>
                                {product.tagline && (
                                    <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
                                )}
                            </div>
                            {!productSlug && <Link href={`/products/${product.slug}`} className="text-sm font-semibold text-primary hover:underline">Explore {product.label} &rarr;</Link>}
                        </div>

                        {product.plans.length === 0 ? <div className="mt-6 plan-card"><h4 className="text-lg font-semibold">Let us find the right fit</h4><p className="mt-2 text-sm text-muted-foreground">Plans are being prepared. Contact our team for pricing and availability.</p><Button asChild className="mt-5 w-fit"><Link href="/#contact">Contact sales</Link></Button></div> : null}
                        {productSlug ? <div className="pricing-preview-layout"><PlanComparison plans={product.plans.map(withPlanDetails)} /><Link href="/products/algosuite/pricing" className="pricing-section-arrow" aria-label="Explore AlgoSuite pricing" title="Explore pricing and compare plans"><ArrowRight className="pricing-link-arrow size-5" aria-hidden="true" /></Link></div> : (
                            <div className="mt-6 plan-grid">
                                {product.plans.map((plan) => {
                                    const fee = formatTransactionFee(plan.transactionFeePercent);
                                    return (
                                        <div
                                            key={plan.id}
                                            className="plan-card transition-shadow hover:shadow-md"
                                        >
                                            <div className="flex items-baseline justify-between gap-2">
                                                <h4 className="font-bold text-foreground">
                                                    {plan.name}
                                                </h4>

                                            </div>
                                            {plan.tagline && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {plan.tagline}
                                                </p>
                                            )}

                                            <p className="mt-5 text-2xl font-bold text-foreground">
                                                {plan.priceAmount == null && plan.trialDays ? `Free for ${plan.trialDays} days` : formatPlanPrice(plan)}
                                            </p>
                                            {fee && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {fee}
                                                </p>
                                            )}
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}
                                            </p>

                                            {plan.features.length > 0 && (
                                                <ul className="mt-5 space-y-2">
                                                    {plan.features.map((feature) => (
                                                        <li key={feature} className="flex items-start gap-2 text-sm">
                                                            <Check
                                                                className="mt-0.5 size-3.5 shrink-0 text-primary"
                                                                aria-hidden="true"
                                                            />
                                                            <span className="text-muted-foreground">
                                                                {feature}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}

                                            <div className="mt-auto pt-6">
                                                <Button asChild className="w-full"><Link href={plan.priceAmount == null && !plan.trialDays ? '/#contact' : `/register?plan=${encodeURIComponent(plan.id)}`}>
                                                    {plan.priceAmount == null && !plan.trialDays ? 'Contact sales' : plan.trialDays ? `Start ${plan.trialDays}-day trial` : `Choose ${plan.name}`}
                                                </Link></Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
