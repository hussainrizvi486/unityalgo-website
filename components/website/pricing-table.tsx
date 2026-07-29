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
        <section className="py-24 bg-gray-50">
            <div className="container mx-auto px-4 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl font-bold  mb-4">{heading}</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">{subheading}</p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8">
                    {plans.map((plan, idx) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                                'rounded-3xl p-8 border transition-all duration-300',
                                plan.highlighted
                                    ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/20 scale-105'
                                    : 'bg-white border-gray-100 hover:border-brand-200 hover:shadow-lg'
                            )}
                        >
                            <h3 className={cn('text-lg font-bold mb-2', plan.highlighted ? 'text-white' : 'text-gray-900')}>
                                {plan.name}
                            </h3>

                            <div className="mb-6">
                                <span className="text-4xl font-bold">
                                    {plan.price === 'Contact' ? 'Contact Us' : `$${plan.price}`}
                                </span>
                                {plan.price !== 'Contact' && (
                                    <span className={cn('text-sm ml-1', plan.highlighted ? 'text-white/60' : 'text-gray-500')}>
                                        {plan.priceSuffix ?? '/mo'}
                                    </span>
                                )}
                            </div>

                            <p className={cn('text-sm mb-8 pb-8 border-b', plan.highlighted ? 'text-white/70 border-white/10' : 'text-gray-500 border-gray-100')}>
                                {plan.users === 'Contact' ? 'Custom user count' : `Up to ${plan.users} users`}
                            </p>

                            {plan.features && (
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-3 text-sm">
                                            <Check className={cn('w-4 h-4 shrink-0', plan.highlighted ? 'text-brand-400' : 'text-brand-600')} />
                                            <span className={plan.highlighted ? 'text-white/90' : 'text-gray-700'}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <Link href={plan.ctaHref ?? '/#contact'}>
                                <Button
                                    className={cn(
                                        'w-full rounded-full h-11',
                                        plan.highlighted
                                            ? 'bg-white  hover:bg-gray-100'
                                            : 'bg-brand-600 hover:bg-brand-700 text-white'
                                    )}
                                >
                                    {plan.ctaLabel ?? (plan.price === 'Contact' ? 'Contact Sales' : 'Request Demo')}
                                </Button>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
