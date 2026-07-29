'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { SidebarOverview } from '@/components/website/sidebar-overview';
import { FeaturesGrid } from '@/components/website/features-grid';
import { PricingTable } from '@/components/website/pricing-table';
import { FaqSection } from '@/components/website/faq-section';

const overviewOptions = [
    {
        title: 'Accelerate Financial Closing',
        description:
            'Simplify period-end and year-end closing processes with centralized financial data, automated reconciliations, and accurate reporting.',
        image: '/images/erp-dashboard.png',
    },
    {
        title: 'Manage Multi-Entity Finances',
        description:
            'Consolidate financial information across multiple companies, branches, and currencies while maintaining standardized accounting practices.',
        image: '/images/erp-workspace.png',
    },
    {
        title: 'Gain Complete Financial Visibility',
        description:
            'Access real-time financial data, dashboards, and reports to monitor business performance, track key metrics, and make informed decisions with confidence.',
        image: '/images/erp-listview.png',
    },
    {
        title: 'Optimize Cost Control',
        description:
            'Track expenses, monitor departmental spending, and analyze profitability to identify opportunities for cost reduction and operational improvement.',
        image: '/images/erp-pos.png',
    },
    {
        title: 'Make Analytics Accessible',
        description:
            'Easily create reports, dashboards, and insights with business performance analytics to help you make informed decisions and optimize your operational workflow.',
        image: '/images/erp-development.png',
    },
];

const features = [
    'Financial Management',
    'Accounts Receivable & Payable',
    'Asset Management',
    'Cash & Banking Management',
    'Financial Reporting & Analytics',
    'Budgeting & Forecasting',
    'Tax & Compliance',
    'Automation & Productivity',
];

const pricingPlans = [
    { name: 'Basic', price: '10.00', priceSuffix: '/mo', users: '5' },
    { name: 'Premium', price: '50.00', priceSuffix: '/mo', users: '25', highlighted: true },
    { name: 'Enterprise', price: 'Contact', users: 'Contact' },
];

const faqItems = [
    {
        question: 'How long does it take to close a financial period?',
        answer: 'With automated reconciliations and centralized data, most teams cut period-end closing time significantly compared to spreadsheet-based processes. Exact timelines depend on entity count and data readiness.',
    },
    {
        question: 'Can it handle multiple companies, branches, and currencies?',
        answer: 'Yes. The platform consolidates financial data across multiple entities, branches, and currencies while keeping each entity’s books standardized and auditable.',
    },
    {
        question: 'Is my financial data migrated safely?',
        answer: 'We run a structured migration process with reconciliation checks at every step, so opening balances, transactions, and historical records match your existing books before go-live.',
    },
    {
        question: 'What compliance and tax capabilities are included?',
        answer: 'Tax & Compliance tooling covers automated tax calculations, audit trails, and reporting aligned to your jurisdiction’s requirements.',
    },
    {
        question: 'Does it integrate with our existing banking and payment tools?',
        answer: 'Cash & Banking Management supports bank feed integrations and reconciliation workflows, and the platform is built to connect with common payment and banking providers.',
    },
];

export const MainContent = () => {
    return (
        <>
            {/* --- HERO / LANDING SECTION --- */}
            <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-4">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="container mx-auto max-w-6xl relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6">
                                <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                                <span className="text-xs font-semibold text-brand-700 tracking-wide uppercase">Financial Management</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-bold tracking-tight  mb-8 text-balance">
                                Finance Transformation
                            </h1>
                            <p className="text-xl text-gray-600 leading-relaxed text-balance mb-10">
                                Accelerate business outcomes and achieve operational excellence through connected and automated finance operations.
                            </p>

                            <Link href="/#contact">
                                <Button size="lg" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8 h-12 text-base shadow-lg shadow-brand-500/20">
                                    Request Demo
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
                        >
                            <div className="aspect-[16/10] bg-gray-200 relative">
                                <Image
                                    src="/images/erp-dashboard.png"
                                    alt="Financial Management Dashboard"
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
                heading="Overview"
                subheading="Everything you need to run finance operations with confidence, from close to consolidation."
                options={overviewOptions}
            />

            {/* --- FEATURES SECTION --- */}
            <FeaturesGrid
                heading="Features"
                subheading="A complete toolkit for modern financial management."
                features={features}
            />

            {/* --- PRICING SECTION --- */}
            <PricingTable heading="Pricing Plans" plans={pricingPlans} />

            {/* --- FAQ SECTION --- */}
            <FaqSection items={faqItems} />

            {/* --- CTA --- */}
            <section className="py-24 bg-gradient-to-br from-brand-900 to-black text-white text-center px-4">
                <div className="container mx-auto max-w-3xl">
                    <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Finance Operations?</h2>
                    <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                        Schedule a free consultation to see how our financial management solution can streamline your operations.
                    </p>
                    <Link href="/#contact">
                        <Button size="lg" className="bg-white  hover:bg-gray-100 rounded-full px-8 h-12">
                            Request Demo
                        </Button>
                    </Link>
                </div>
            </section>
        </>
    );
};
