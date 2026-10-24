import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { planFeatureValues, pricingPlanAction, type PricingPlan } from '@/lib/pricing-plans';
import { formatPlanPrice, formatTransactionFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

export function PlanComparison({ plans }: { plans: PricingPlan[] }) {
    if (!plans.length) return null;
    const features = plans.map(planFeatureValues);
    const labels = new Map<string, string>();
    for (const values of features) {
        for (const [key, feature] of values) labels.set(key, feature.label);
    }
    const hasTrials = plans.some((plan) => Boolean(plan.trialDays));
    const hasFees = plans.some((plan) => plan.transactionFeePercent != null);

    return (
        <div className="mt-10">
            <p className="mb-4 text-sm text-muted-foreground lg:hidden">
                Swipe or scroll horizontally to compare every plan.
            </p>
            <div className="plan-comparison-scroll" role="region" aria-label="AlgoSuite plan comparison" tabIndex={0}>
                <table className="plan-comparison" style={{ '--plan-count': plans.length } as CSSProperties}>
                    <caption className="sr-only">Compare AlgoSuite pricing, seats, and included features across all plans.</caption>
                    <thead>
                        <tr>
                            <th scope="col" className="plan-comparison-label"><h3>Compare all features</h3></th>
                            {plans.map((plan) => {
                                const action = pricingPlanAction(plan);
                                return (
                                    <th scope="col" key={plan.id}>
                                        <div className="plan-comparison-heading">{plan.name}</div>
                                        <Button asChild variant="outline" className="mt-4 rounded-full border-foreground">
                                            <Link href={action.href} aria-label={`${action.label}: ${plan.name}`}>
                                                {action.label}
                                            </Link>
                                        </Button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="plan-comparison-group"><th colSpan={plans.length + 1} scope="colgroup">Pricing</th></tr>
                        <tr>
                            <th scope="row">Pay monthly</th>
                            {plans.map((plan) => <td key={plan.id}>{plan.priceAmount == null && plan.trialDays ? `Free for ${plan.trialDays} days` : formatPlanPrice(plan)}</td>)}
                        </tr>
                        {hasTrials && <tr><th scope="row">Free trial</th>{plans.map((plan) => <td key={plan.id}>{plan.trialDays ? `${plan.trialDays} days` : <NotListed />}</td>)}</tr>}
                        {hasFees && <tr><th scope="row">Transaction fee</th>{plans.map((plan) => <td key={plan.id}>{formatTransactionFee(plan.transactionFeePercent) ?? <NotListed />}</td>)}</tr>}
                        <tr className="plan-comparison-group"><th colSpan={plans.length + 1} scope="colgroup">Core features</th></tr>
                        <tr><th scope="row">Team seats</th>{plans.map((plan) => <td key={plan.id}>{plan.userLimit == null ? 'Unlimited' : `Up to ${plan.userLimit}`}</td>)}</tr>
                        {[...labels].map(([key, label]) => (
                            <tr key={key}>
                                <th scope="row">{label}</th>
                                {plans.map((plan, index) => {
                                    const value = features[index].get(key)?.value;
                                    return <td key={plan.id}>{value === true ? <span className="inline-flex items-center"><Check className="size-5 rounded-full bg-success p-0.5 text-primary-foreground" aria-hidden="true" /><span className="sr-only">Included</span></span> : value ?? <NotListed />}</td>;
                                })}
                            </tr>
                        ))}
                        {plans.some((plan) => plan.vcpu != null || plan.ramMb != null || plan.storageGb != null) && <>
                            <tr className="plan-comparison-group"><th colSpan={plans.length + 1} scope="colgroup">Hosting resources</th></tr>
                            {([
                                ['vcpu', 'CPU', 'vCPU'],
                                ['ramMb', 'Memory', 'MB'],
                                ['storageGb', 'Storage', 'GB'],
                            ] as const).filter(([key]) => plans.some((plan) => plan[key] != null)).map(([key, label, unit]) => (
                                <tr key={key}><th scope="row">{label}</th>{plans.map((plan) => <td key={plan.id}>{plan[key] != null ? `${plan[key]} ${unit}` : <NotListed />}</td>)}</tr>
                            ))}
                        </>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function NotListed() {
    return <span className="text-muted-foreground"><span aria-hidden="true">&mdash;</span><span className="sr-only">Not listed</span></span>;
}
