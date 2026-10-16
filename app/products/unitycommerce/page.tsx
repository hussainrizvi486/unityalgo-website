import React from 'react';
import Script from 'next/script';
import { Header, Footer } from '@/components/layouts';
import { generateBreadcrumbJsonLd, generatePageMetadata } from '@/lib/metadata';
import { MainContent, type UnityCommercePlan } from './client';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatCurrencyAmount } from '@/lib/currency';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Unity Commerce', path: '/products/unitycommerce' },
]);

export const dynamic = 'force-dynamic';

export const metadata = generatePageMetadata({
    title: 'Unity Commerce | Build and Manage Your Online Store',
    description:
        'Launch and manage your online store with professional themes, powerful commerce tools and complete control over your brand.',
    keywords: [
        'Unity Commerce',
        'E-commerce Platform Pakistan',
        'Online Store Builder',
        'E-commerce Website',
        'Store Management Software',
        'Online Store Pakistan',
    ],
    path: '/products/unitycommerce',
});

const Page = async () => {
    const plans = await loadPlans();

    return (
        <div className="bg-card text-foreground min-h-screen overflow-hidden">
            <Script
                id="unity-commerce-breadcrumbs"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />
            <Header />
            <MainContent plans={plans} />
            <Footer />
        </div>
    );
};

export default Page;


const ANNUAL_DISCOUNT = 0.8;

async function loadPlans(): Promise<UnityCommercePlan[]> {
    const plans = await db.query.plan.findMany({
        where: and(eq(schema.plan.productId, 'unity_commerce'), eq(schema.plan.isActive, true)),
        with: { currency: true },
        orderBy: asc(schema.plan.sortOrder),
    });

    return plans.map((plan, index) => ({
        name: plan.name,
        monthlyPrice: plan.priceAmount == null
            ? null
            : formatCurrencyAmount(plan.priceAmount, plan.currency),
        annualPrice: plan.priceAmount == null
            ? null
            : formatCurrencyAmount(plan.priceAmount * ANNUAL_DISCOUNT, plan.currency),
        audience: plan.tagline ?? '',
        features: plan.features,
        // The middle plan carries the emphasis, which is where the hand-written
        // grid put it and where a three-tier table conventionally puts it.
        highlighted: plans.length > 2 && index === Math.floor((plans.length - 1) / 2),
    }));
}
