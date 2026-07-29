'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';
import { defaultPricingPlans } from '@/lib/default-pricing';

// placeholder copy — replace with real content
const config: ModulePageConfig = {
    badge: 'Retail & POS',
    heading: 'Retail Operations',
    subheading:
        'Run a modern point of sale, manage multi-store inventory, and unify online and in-store sales in one connected retail platform.',
    heroImage: '/images/erp-pos.png',
    overviewOptions: [
        {
            title: 'Modern Point of Sale',
            description:
                'A touch-friendly, offline-capable POS that handles discounts, returns, and multi-currency payments seamlessly.',
            image: '/images/erp-pos.png',
        },
        {
            title: 'Multi-Store Inventory',
            description:
                'Manage inventory across every store location with real-time stock visibility and automated transfers.',
            image: '/images/erp-workspace.png',
        },
        {
            title: 'Customer Loyalty Programs',
            description:
                'Reward repeat customers with integrated loyalty points, discounts, and personalized promotions.',
            image: '/images/erp-listview.png',
        },
        {
            title: 'Omnichannel Sales',
            description:
                'Unify online and in-store sales channels with a single view of orders, inventory, and customers.',
            image: '/images/erp-dashboard.png',
        },
    ],
    features: [
        'Point of Sale (POS)',
        'Multi-Store Inventory',
        'Customer Loyalty Programs',
        'Discounts & Promotions',
        'Omnichannel Sales',
        'Sales Reporting & Analytics',
        'Returns & Exchanges',
        'Multi-Currency Payments',
    ],
    pricingPlans: defaultPricingPlans,
    faqItems: [
        {
            question: 'Does the POS work offline?',
            answer: 'Yes, the point of sale is offline-capable and automatically syncs transactions once connectivity is restored.',
        },
        {
            question: 'Can I manage inventory across multiple store locations?',
            answer: 'Yes, stock levels, transfers, and replenishment are managed centrally across every store from one dashboard.',
        },
        {
            question: 'Does it support loyalty programs and promotions?',
            answer: 'Yes, you can configure loyalty points, tiered discounts, and time-bound promotions directly in the platform.',
        },
        {
            question: 'Can I sell across both online and physical stores?',
            answer: 'Yes, the platform gives you a unified view of orders, inventory, and customers across online and in-store channels.',
        },
    ],
    ctaHeading: 'Ready to Modernize Your Retail Operations?',
    ctaDescription:
        'Schedule a free consultation to see how our retail solution can unify your stores and boost customer loyalty.',
};

export const MainContent = () => <ModulePageContent config={config} />;
