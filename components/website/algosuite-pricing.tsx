'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, Columns3, Layers } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { PlanComparison } from '@/components/website/plan-comparison';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { planFeatureValues, pricingPlanAction, type PricingPlan } from '@/lib/pricing-plans';

function priceLabel(plan: PricingPlan) {
    return plan.priceAmount == null && plan.trialDays ? `Free for ${plan.trialDays} days` : formatPlanPrice(plan);
}

export function AlgoSuitePricing({ plans }: { plans: PricingPlan[] }) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const selected = plans.filter((plan) => selectedIds.includes(plan.id));
    const comparing = selected.length >= 2;
    const featureGroups = new Map<string, { label: string; plans: { plan: PricingPlan; value: string | true }[] }>();
    for (const plan of plans) {
        for (const [key, feature] of planFeatureValues(plan)) {
            const group = featureGroups.get(key) ?? { label: feature.label, plans: [] };
            group.plans.push({ plan, value: feature.value });
            featureGroups.set(key, group);
        }
    }
    function select(id: string, checked: boolean) {
        setSelectedIds((ids) => checked ? [...new Set([...ids, id])] : ids.filter((candidate) => candidate !== id));
    }

    if (!plans.length) return <section className="plan-card"><h2 className="text-xl">Plans are on their way</h2><p className="mt-2 text-muted-foreground">Contact our team for pricing and availability.</p><Button asChild className="mt-5 w-fit"><Link href="/#contact">Contact sales</Link></Button></section>;

    return (
        <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-2xl tracking-tight">Find your plan</h2><p className="mt-2 text-sm text-muted-foreground">Monthly pricing. Expand any plan for the full picture.</p></div>
                <a href="#pricing-details" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Explore modules<ArrowDown className="size-4" /></a>
            </div>
            <Accordion type="multiple" className="plan-grid pricing-plan-picker">
                {plans.map((plan) => <PlanDetail key={plan.id} plan={plan} selected={selectedIds.includes(plan.id)} onSelect={(checked) => select(plan.id, checked)} />)}
            </Accordion>
            <div className="pricing-compare-toolbar">
                <div className="flex items-center gap-3"><Columns3 className="size-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Compare plans</p><p className="mt-0.5 text-xs text-muted-foreground" role="status">{selected.length === 0 ? 'Select two or more plans above to compare.' : comparing ? `${selected.length} plans selected. Your comparison is shown below.` : 'One plan selected. Choose one more to compare.'}</p></div></div>
                <div className="flex flex-wrap items-center gap-3">
                    {selected.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Clear selection</Button>}
                    {comparing && <Button asChild variant="outline" size="sm"><a href="#pricing-details">View comparison<ArrowDown className="size-4" /></a></Button>}
                </div>
            </div>
            <section id="pricing-details" className="pricing-details">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{comparing ? 'Side by side' : 'Explore the suite'}</p><h2 className="mt-3 text-3xl tracking-tight">{comparing ? 'The details that make the difference' : 'Modules, grouped around your work'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{comparing ? 'Compare the pricing, capabilities, and resources of your selected plans.' : 'Explore the modules and capabilities listed in our plans. Open a group to see available plans and their pricing.'}</p></div>
                </div>
                {comparing ? <PlanComparison plans={selected} /> : featureGroups.size > 0 ? (
                    <Accordion type="multiple" className="pricing-module-grid">
                        {[...featureGroups].map(([key, group]) => (
                            <AccordionItem key={key} value={key} className="pricing-module-card">
                                <AccordionTrigger className="gap-4 py-5"><span className="flex min-w-0 items-center gap-3"><span className="pricing-module-icon"><Layers className="size-5" /></span><span><span className="block text-base font-medium">{group.label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Available in {group.plans.length} {group.plans.length === 1 ? 'plan' : 'plans'}</span></span></span></AccordionTrigger>
                                <AccordionContent className="pb-5">
                                    <ul className="divide-y divide-border">
                                        {group.plans.map(({ plan, value }) => <li key={plan.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{plan.name}</span><span>{priceLabel(plan)}</span></div><p className="mt-1 text-xs text-muted-foreground">{value === true ? 'Included in this plan' : value}</p><Link href={pricingPlanAction(plan).href} className="mt-3 inline-flex items-center gap-2 text-xs font-medium hover:underline">{pricingPlanAction(plan).label}<ArrowRight className="size-3.5" /><span className="sr-only">: {plan.name}</span></Link></li>)}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : <p className="mt-8 text-sm text-muted-foreground">Module details have not been listed yet. Expand a plan above to review its pricing and resources.</p>}
            </section>
        </>
    );
}

function PlanDetail({ plan, selected, onSelect }: { plan: PricingPlan; selected: boolean; onSelect: (checked: boolean) => void }) {
    const id = useId();
    const features = [...planFeatureValues(plan).values()];
    const action = pricingPlanAction(plan);
    const fee = formatTransactionFee(plan.transactionFeePercent);
    return (
        <AccordionItem value={plan.id} className="pricing-plan-card last:border-b" data-selected={selected}>
            <div className="flex items-center gap-2 border-b border-border pb-4">
                <Checkbox id={id} checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} aria-label={`Compare ${plan.name}`} />
                <label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground">Add to comparison</label>
            </div>
            <AccordionTrigger className="items-start gap-3 py-5" aria-label={`View ${plan.name} details`}>
                <span className="min-w-0"><span className="block text-lg font-semibold">{plan.name}</span>{plan.tagline && <span className="mt-2 block text-sm font-normal leading-6 text-muted-foreground">{plan.tagline}</span>}<span className="mt-5 block break-words text-2xl font-semibold tracking-tight">{priceLabel(plan)}</span><span className="mt-2 block text-xs font-normal text-muted-foreground">{plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}</span><span className="mt-5 block text-xs font-medium underline underline-offset-4">Plan details</span></span>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border pt-5">
                {features.length > 0 && <><p className="mb-3 text-xs font-semibold uppercase tracking-wide">Included capabilities</p><ul className="space-y-3">{features.map((feature) => <li key={feature.label} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /><span>{feature.label}{feature.value !== true ? `: ${feature.value}` : ''}</span></li>)}</ul></>}
                {(plan.vcpu != null || plan.ramMb != null || plan.storageGb != null) && <div className="mt-5 border-t border-border pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide">Hosting resources</p><dl className="space-y-2 text-muted-foreground">{plan.vcpu != null && <div className="flex justify-between gap-2"><dt>CPU</dt><dd>{plan.vcpu} vCPU</dd></div>}{plan.ramMb != null && <div className="flex justify-between gap-2"><dt>Memory</dt><dd>{plan.ramMb} MB</dd></div>}{plan.storageGb != null && <div className="flex justify-between gap-2"><dt>Storage</dt><dd>{plan.storageGb} GB</dd></div>}</dl></div>}
                {Boolean(plan.trialDays) && <p className="mt-4 text-xs text-muted-foreground">{plan.trialDays}-day free trial</p>}
                {fee && <p className="mt-3 text-xs text-muted-foreground">{fee}</p>}
                <Button asChild className="mt-5 w-full"><Link href={action.href}>{action.label}<span className="sr-only">: {plan.name}</span></Link></Button>
            </AccordionContent>
        </AccordionItem>
    );
}
