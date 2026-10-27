import type { Plan } from '@/db/types';
import type { PriceCurrency } from '@/lib/pricing';

/** Public catalog fields only; billing provider IDs stay on the server. */
export type PricingPlan = Pick<Plan,
    'id' | 'name' | 'tagline' | 'priceAmount' | 'priceUnit' | 'transactionFeePercent' |
    'userLimit' | 'features' | 'trialDays' | 'vcpu' | 'ramMb' | 'storageGb'
> & { currency?: PriceCurrency | null, metadata?: string };

// The catalog supports bundled features and label:value details.
export function planFeatureValues(plan: Pick<PricingPlan, 'metadata'>) {
    const values = new Map<string, { label: string; value: string | true }>();
    if (plan.metadata){
        let metadata = null 
        try {
            metadata = JSON.parse(plan.metadata)
        } catch (error) {            
        } 
        if (metadata) {
            if(metadata.features){
                metadata.
            }
        }
    }


    return values;
}


export function pricingPlanAction(plan: PricingPlan) {
    const quote = plan.priceAmount == null && !plan.trialDays;
    return {
        href: quote ? '/#contact' : `/register?plan=${encodeURIComponent(plan.id)}`,
        label: quote ? 'Contact sales' : plan.trialDays ? 'Start free trial' : 'Choose plan',
    };
}
