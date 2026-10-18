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
    heroAlt?: string;
    overviewOptions: OverviewOption[];
    features: string[];
    pricingPlans?: PricingPlan[];
    faqItems: FaqItem[];
    ctaHeading: string;
    ctaDescription: string;
    ctaLabel?: string;
    /** Heading above the overview panel, and the line under it. */
    overviewHeading?: string;
    overviewSubheading?: string;
}

export function ModulePageContent({ config }: { config: ModulePageConfig }) {
    return (
        <>
            {/* --- HERO / LANDING SECTION --- */}
            <section className="relative pt-hero pb-section px-page">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,var(--scrim)_30%,transparent_70%)] opacity-30 pointer-events-none" />
                <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                <div className="site-container site-container-wide relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-primary/15 mb-6">
                                <span className="w-2 h-2 rounded-full bg-primary motion-safe:animate-pulse" />
                                <span className="text-xs font-semibold text-primary tracking-wide uppercase">{config.badge}</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl tracking-tight mb-8 text-balance">
                                {config.heading}
                            </h1>
                            <p className="text-xl text-foreground/70 leading-relaxed text-balance mb-10">
                                {config.subheading}
                            </p>

                            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 text-base shadow-lg shadow-foreground/10"><Link href="/#contact">
                                    {config.ctaLabel ?? 'Request Demo'}
                                </Link></Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative rounded-xl shadow-2xl overflow-hidden border border-border"
                        >
                            <div className="aspect-16/10 bg-border relative">
                                <Image
                                    src={config.heroImage}
                                    alt={config.heroAlt ?? config.heading}
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
            <SidebarOverview
                options={config.overviewOptions}
                {...(config.overviewHeading ? { heading: config.overviewHeading } : {})}
                {...(config.overviewSubheading ? { subheading: config.overviewSubheading } : {})}
            />

            {/* --- FEATURES SECTION --- */}
            <FeaturesGrid features={config.features} />

            {/* --- PRICING SECTION --- */}
            {config.pricingPlans ? <PricingTable plans={config.pricingPlans} /> : null}

            {/* --- FAQ SECTION --- */}
            <FaqSection items={config.faqItems} />

            {/* --- CTA --- */}
            <section className="bg-gradient-to-br from-primary to-scrim text-primary-foreground text-center px-page site-section-spacing">
                <div className="site-container site-container-reading">
                    <h2 className="text-4xl mb-6">{config.ctaHeading}</h2>
                    <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">{config.ctaDescription}</p>
                    <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-8 h-12"><Link href="/#contact">
                            {config.ctaLabel ?? 'Request Demo'}
                        </Link></Button>
                </div>
            </section>
        </>
    );
}
