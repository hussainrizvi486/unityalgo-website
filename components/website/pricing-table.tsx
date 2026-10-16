'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export interface PricingPlan {
    name: string;
    price: string;
    priceSuffix?: string;
    users: string;
    features?: string[];
    highlighted?: boolean;
    ctaLabel?: string;
    ctaHref?: string;
}

interface PricingTableProps {
    heading?: string;
    subheading?: string;
    plans: PricingPlan[];
}

export function PricingTable({
    heading = 'Pricing Plans',
    subheading = 'Simple, transparent pricing that scales with your business.',
    plans,
}: PricingTableProps) {
    return (
        <section className="bg-muted site-section-spacing">
            <div className="site-container site-gutters site-container-wide">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl mb-4">{heading}</h2>
                    <p className="text-foreground/70 max-w-2xl mx-auto">{subheading}</p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-gap-xl">
                    {plans.map((plan, idx) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                                'rounded-2xl p-8 border transition-all duration-300',
                                plan.highlighted
                                    ? 'bg-primary border-foreground text-primary-foreground shadow-xl shadow-foreground/20 scale-105'
                                    : 'bg-card border-border/60 hover:border-primary/25 hover:shadow-lg'
                            )}
                        >
                            <h3 className={cn('text-lg font-bold mb-2', plan.highlighted ? 'text-primary-foreground' : 'text-foreground')}>
                                {plan.name}
                            </h3>

                            <div className="mb-6">
                                <span className="text-4xl font-bold">
                                    {plan.price === 'Contact' ? 'Contact Us' : `$${plan.price}`}
                                </span>
                                {plan.price !== 'Contact' && (
                                    <span className={cn('text-sm ml-1', plan.highlighted ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                        {plan.priceSuffix ?? '/mo'}
                                    </span>
                                )}
                            </div>

                            <p className={cn('text-sm mb-8 pb-8 border-b', plan.highlighted ? 'text-primary-foreground/70 border-primary-foreground/10' : 'text-muted-foreground border-border/60')}>
                                {plan.users === 'Contact' ? 'Custom user count' : `Up to ${plan.users} users`}
                            </p>

                            {plan.features && (
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-3 text-sm">
                                            <Check className={cn('w-4 h-4 shrink-0', plan.highlighted ? 'text-primary-foreground' : 'text-primary')} />
                                            <span className={plan.highlighted ? 'text-primary-foreground/90' : 'text-foreground/80'}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <Button asChild
                                    className={cn(
                                        'w-full h-11',
                                        plan.highlighted
                                            ? 'bg-card hover:bg-secondary text-primary'
                                            : 'bg-primary hover:bg-primary/90 text-primary-foreground',
                                    )}
                                ><Link href={plan.ctaHref ?? '/#contact'}>
                                    {plan.ctaLabel ?? (plan.price === 'Contact' ? 'Contact Sales' : 'Request Demo')}
                                </Link></Button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
