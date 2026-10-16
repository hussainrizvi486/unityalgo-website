import Link from 'next/link';
import { Check } from 'lucide-react';
import { listProductsWithPlans } from '@/lib/products';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

/**
 * Plans, straight from the database.
 *
 * Products and plans are rows, so this renders whatever is currently active
 * and in what order — editing a price or adding a tier in /admin/plans changes
 * the landing page on the next request, with no redeploy. A product with no
 * active plans is skipped rather than shown as an empty column.
 *
 * Server component: it reads Prisma directly, so nothing about pricing ships
 * to the browser as JavaScript.
 */
export async function PlansSection() {
    const products = await listProductsWithPlans();
    if (products.length === 0) return null;

    return (
        <section id="plans" className="scroll-mt-24 bg-card site-section-spacing">
            <div className="site-container site-gutters">
                <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Our products
                    </p>
                    <h2 className="mt-3 text-3xl tracking-tight text-foreground md:text-4xl">
                        Software we build, own and sell
                    </h2>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                        We don&apos;t only build for clients — we run our own products. Every plan
                        below is one we operate and support ourselves.
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
                            <Link
                                href={`/products/${product.slug}`}
                                className="text-sm font-semibold text-primary hover:underline"
                            >
                                Explore {product.label} →
                            </Link>
                        </div>

                        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {product.plans.map((plan, index) => {
                                // The middle tier of three is the one most buyers
                                // should land on, so it carries the emphasis.
                                const featured = product.plans.length === 3 && index === 1;
                                const fee = formatTransactionFee(plan.transactionFeePercent);
                                return (
                                    <div
                                        key={plan.id}
                                        className={cn(
                                            'flex flex-col rounded-xl border p-card transition-shadow',
                                            featured
                                                ? 'border-foreground bg-primary text-primary-foreground shadow-lg'
                                                : 'border-border bg-card hover:shadow-md',
                                        )}
                                    >
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h4 className={cn('font-bold', featured ? 'text-primary-foreground' : 'text-foreground')}>
                                                {plan.name}
                                            </h4>
                                            {featured && (
                                                <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide">
                                                    Popular
                                                </span>
                                            )}
                                        </div>
                                        {plan.tagline && (
                                            <p className={cn('mt-1 text-xs', featured ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                                {plan.tagline}
                                            </p>
                                        )}

                                        <p className={cn('mt-5 text-2xl font-bold', featured ? 'text-primary-foreground' : 'text-foreground')}>
                                            {formatPlanPrice(plan)}
                                        </p>
                                        {fee && (
                                            <p className={cn('mt-1 text-xs', featured ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                                {fee}
                                            </p>
                                        )}
                                        <p className={cn('mt-1 text-xs', featured ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                            {plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}
                                        </p>

                                        {plan.features.length > 0 && (
                                            <ul className="mt-5 space-y-2">
                                                {plan.features.map((feature) => (
                                                    <li key={feature} className="flex items-start gap-2 text-sm">
                                                        <Check
                                                            className={cn(
                                                                'mt-0.5 size-3.5 shrink-0',
                                                                featured ? 'text-primary-foreground/70' : 'text-primary',
                                                            )}
                                                            aria-hidden="true"
                                                        />
                                                        <span className={featured ? 'text-primary-foreground/80' : 'text-foreground/70'}>
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <div className="mt-auto pt-6">
                                            <Button asChild
                                                    className={cn(
                                                        'w-full',
                                                        featured
                                                            ? 'bg-card text-foreground hover:bg-secondary'
                                                            : 'bg-primary text-primary-foreground hover:bg-primary/90',
                                                    )}
                                                ><Link href="/register" className="block">
                                                    {plan.priceAmount == null ? 'Talk to us' : `Start with ${plan.name}`}
                                                </Link></Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
