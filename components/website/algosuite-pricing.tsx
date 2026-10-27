'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, ChevronDown, Columns3, Headset, Layers } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlanComparison } from '@/components/website/plan-comparison';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { planFeatureValues, planResources, pricingPlanAction, type PricingPlan } from '@/lib/pricing-plans';

function priceLabel(plan: PricingPlan) {
    return plan.priceAmount == null && plan.trialDays ? `Free for ${plan.trialDays} days` : formatPlanPrice(plan);
}

/** "$29/mo" as the amount and its unit, so the card can set the unit small. */
function splitPrice(plan: PricingPlan) {
    const label = priceLabel(plan);
    const at = label.indexOf('/');
    return at === -1 ? { amount: label, unit: '' } : { amount: label.slice(0, at), unit: label.slice(at) };
}

const FEATURES_SHOWN = 6;

export function AlgoSuitePricing({ plans }: { plans: PricingPlan[] }) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [category, setCategory] = useState<string | null>(null);
    const categories = [...new Set(plans.map((plan) => plan.details.category).filter((value): value is string => Boolean(value)))];
    const visible = category ? plans.filter((plan) => plan.details.category === category) : plans;
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
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-2xl tracking-tight">Find your plan</h2><p className="mt-2 text-sm text-muted-foreground">Monthly pricing. Every plan includes managed hosting and updates.</p></div>
                <a href="#pricing-details" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">Explore modules<ArrowDown className="size-4" /></a>
            </div>
            {categories.length > 1 && (
                <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter plans by industry">
                    {[null, ...categories].map((name) => (
                        <Button key={name ?? 'all'} type="button" size="sm" variant={category === name ? 'default' : 'outline'} aria-pressed={category === name} onClick={() => setCategory(name)} className="rounded-full">{name ?? 'All plans'}</Button>
                    ))}
                </div>
            )}
            <div className="plan-grid pricing-plan-picker">
                {visible.map((plan) => <PlanCard key={plan.id} plan={plan} selected={selectedIds.includes(plan.id)} onSelect={(checked) => select(plan.id, checked)} />)}
            </div>
            <div className="pricing-compare-toolbar">
                <div className="flex items-center gap-3"><Columns3 className="size-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Compare plans</p><p className="mt-0.5 text-xs text-muted-foreground" role="status">{selected.length === 0 ? 'Tick Compare on two or more plans to see them side by side.' : comparing ? `${selected.length} plans selected. Your comparison is shown below.` : 'One plan selected. Choose one more to compare.'}</p></div></div>
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

function PlanCard({ plan, selected, onSelect }: { plan: PricingPlan; selected: boolean; onSelect: (checked: boolean) => void }) {
    const id = useId();
    const [expanded, setExpanded] = useState(false);
    const features = [...planFeatureValues(plan).values()];
    const shown = expanded ? features : features.slice(0, FEATURES_SHOWN);
    const resources = planResources(plan);
    const action = pricingPlanAction(plan);
    const fee = formatTransactionFee(plan.transactionFeePercent);
    const { amount, unit } = splitPrice(plan);
    return (
        <article className="pricing-plan-card flex flex-col" data-selected={selected}>
            <div className="flex min-h-7 items-center justify-between gap-2">
                {plan.details.category ? <Badge variant="neutral">{plan.details.category}</Badge> : <span />}
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox id={id} checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} aria-label={`Compare ${plan.name}`} />Compare
                </label>
            </div>
            <h3 className="mt-4 text-xl font-semibold">{plan.name}</h3>
            {plan.tagline && <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.tagline}</p>}
            <p className="mt-6 flex flex-wrap items-baseline gap-x-1 break-words"><span className="text-3xl font-semibold tracking-tight">{amount}</span>{unit && <span className="text-sm text-muted-foreground">{unit}</span>}</p>
            <p className="mt-1 text-xs text-muted-foreground">
                {plan.userLimit == null ? 'Unlimited seats' : `Up to ${plan.userLimit} seats`}
                {plan.priceAmount != null && plan.trialDays ? ` · ${plan.trialDays}-day free trial` : ''}
            </p>
            <Button asChild className="mt-5 w-full"><Link href={action.href}>{action.label}<span className="sr-only">: {plan.name}</span></Link></Button>
            {(resources.length > 0 || plan.details.support) && (
                <div className="mt-6 border-t border-border pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide">Hosting</p>
                    {resources.length > 0 && (
                        <dl className="grid grid-cols-3 gap-2">
                            {resources.map((resource) => <div key={resource.key} className="min-w-0 rounded-lg bg-muted px-3 py-2"><dt className="text-xs text-muted-foreground">{resource.label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{resource.value}</dd></div>)}
                        </dl>
                    )}
                    {plan.details.support && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Headset className="size-4 shrink-0" aria-hidden="true" />{plan.details.support} support</p>}
                </div>
            )}
            {features.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide">What&apos;s included</p>
                    <ul className="space-y-2.5 text-sm">
                        {shown.map((feature) => <li key={feature.label} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span>{feature.label}{feature.value !== true ? `: ${feature.value}` : ''}</span></li>)}
                    </ul>
                    {features.length > FEATURES_SHOWN && (
                        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline">
                            {expanded ? 'Show fewer' : `Show all ${features.length} features`}<ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                    )}
                </div>
            )}
            {fee && <p className="mt-5 text-xs text-muted-foreground">{fee}</p>}
        </article>
    );
}
