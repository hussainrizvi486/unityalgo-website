import { PricingPlan } from '@/components/website/pricing-table';

export const defaultPricingPlans: PricingPlan[] = [
    { name: 'Basic', price: '10.00', priceSuffix: '/mo', users: '5' },
    { name: 'Premium', price: '50.00', priceSuffix: '/mo', users: '25', highlighted: true },
    { name: 'Enterprise', price: 'Contact', users: 'Contact' },
];
