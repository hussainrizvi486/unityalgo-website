import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header, Footer } from '@/components/layouts';
import { listAlgoSuitePlans } from '@/lib/products';
import { generatePageMetadata } from '@/lib/metadata';
import { AlgoSuitePricing } from '@/components/website/algosuite-pricing';
import type { PricingPlan } from '@/lib/pricing-plans';

export const metadata = generatePageMetadata({
    title: 'AlgoSuite Pricing | Plans, Modules & Comparison',
    description: 'Explore AlgoSuite plans, expand the details, and compare pricing, modules, team seats, and hosting resources for your business.',
    keywords: ['AlgoSuite pricing', 'ERP plans', 'business modules', 'compare plans'],
    path: '/products/algosuite/pricing',
});

export default async function AlgoSuitePricingPage() {
    const catalog = await listAlgoSuitePlans();
    const plans: PricingPlan[] = catalog.map((plan) => ({
        id: plan.id, name: plan.name, tagline: plan.tagline,
        priceAmount: plan.priceAmount, priceUnit: plan.priceUnit,
        transactionFeePercent: plan.transactionFeePercent, userLimit: plan.userLimit,
        features: plan.features, trialDays: plan.trialDays,
        vcpu: plan.vcpu, ramMb: plan.ramMb, storageGb: plan.storageGb,
        currency: plan.currency ? { code: plan.currency.code, symbol: plan.currency.symbol, numberFormat: plan.currency.numberFormat } : null,
    }));
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />
            <main className="pricing-page site-container site-gutters">
                <Link href="/products/algosuite" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to AlgoSuite</Link>
                <div className="pricing-page-intro">
                    <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">AlgoSuite pricing</p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Your team. Your modules.<br />Your next chapter.</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Find the right fit for the way you work. Open a plan to explore the details, or select plans to see exactly how they compare.</p>
                </div>
                <AlgoSuitePricing plans={plans} />
                <section className="pricing-help">
                    <div><h2 className="text-2xl tracking-tight">Need help choosing?</h2><p className="mt-2 text-sm text-muted-foreground">Tell us about your team and workflows. We can help you find a starting point.</p></div>
                    <Link href="/#contact" className="pricing-detail-link group">Talk to our team<span aria-hidden="true">&rarr;</span></Link>
                </section>
            </main>
            <Footer />
        </div>
    );
}
