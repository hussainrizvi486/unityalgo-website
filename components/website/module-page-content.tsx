'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { SidebarOverview, OverviewOption } from '@/components/website/sidebar-overview';
import { FeaturesGrid } from '@/components/website/features-grid';
import { PricingTable, PricingPlan } from '@/components/website/pricing-table';
import { FaqSection, FaqItem } from '@/components/website/faq-section';

export interface ModulePageConfig {
    badge: string;
    heading: string;
    subheading: string;
    heroImage: string;
    overviewOptions: OverviewOption[];
    features: string[];
    pricingPlans: PricingPlan[];
    faqItems: FaqItem[];
    ctaHeading: string;
    ctaDescription: string;
}

export function ModulePageContent({ config }: { config: ModulePageConfig }) {
    return (
        <>
            {/* --- HERO / LANDING SECTION --- */}
            <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-4">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="container mx-auto max-w-6xl relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15 mb-6">
                                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                                <span className="text-xs font-semibold text-brand tracking-wide uppercase">{config.badge}</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-bold tracking-tight  mb-8 text-balance">
                                {config.heading}
                            </h1>
                            <p className="text-xl text-ink-600 leading-relaxed text-balance mb-10">
                                {config.subheading}
                            </p>

                            <Link href="/#contact">
                                <Button size="lg" className="rounded-full bg-brand hover:brightness-90 text-white px-8 h-12 text-base shadow-lg shadow-brand/20">
                                    Request Demo
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative rounded-2xl shadow-2xl overflow-hidden border border-ink-200"
                        >
                            <div className="aspect-[16/10] bg-ink-200 relative">
                                <Image
                                    src={config.heroImage}
                                    alt={config.heading}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    priority
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* --- OVERVIEW SECTION --- */}
            <SidebarOverview options={config.overviewOptions} />

            {/* --- FEATURES SECTION --- */}
            <FeaturesGrid features={config.features} />

            {/* --- PRICING SECTION --- */}
            <PricingTable plans={config.pricingPlans} />

            {/* --- FAQ SECTION --- */}
            <FaqSection items={config.faqItems} />

            {/* --- CTA --- */}
            <section className="py-24 bg-gradient-to-br from-ink-950 to-black text-white text-center px-4">
                <div className="container mx-auto max-w-3xl">
                    <h2 className="text-4xl font-bold mb-6">{config.ctaHeading}</h2>
                    <p className="text-ink-300 mb-8 max-w-2xl mx-auto">{config.ctaDescription}</p>
                    <Link href="/#contact">
                        <Button size="lg" className="bg-white text-ink-600 hover:bg-ink-100 rounded-full px-8 h-12">
                            Request Demo
                        </Button>
                    </Link>
                </div>
            </section>
        </>
    );
}
