'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';
import { defaultPricingPlans } from '@/lib/default-pricing';

// placeholder copy — replace with real content
const config: ModulePageConfig = {
    badge: 'Inventory & Stock',
    heading: 'Stock Management',
    subheading:
        'Track inventory across every location in real time, automate replenishment, and eliminate stockouts with a connected inventory platform.',
    heroImage: '/images/erp-workspace.png',
    overviewOptions: [
        {
            title: 'Real-Time Stock Visibility',
            description:
                'Monitor stock levels across all warehouses and locations in real time, with instant alerts when items run low.',
            image: '/images/erp-listview.png',
        },
        {
            title: 'Multi-Location Transfers',
            description:
                'Move inventory between warehouses and branches with automated transfer orders and full traceability.',
            image: '/images/erp-workspace.png',
        },
        {
            title: 'Automated Replenishment',
            description:
                'Set reorder points and let the system automatically trigger purchase orders before you run out of stock.',
            image: '/images/erp-dashboard.png',
        },
        {
            title: 'Batch & Serial Tracking',
            description:
                'Track inventory down to the batch or serial number for full traceability and compliance.',
            image: '/images/erp-pos.png',
        },
    ],
    features: [
        'Inventory Tracking',
        'Warehouse Management',
        'Stock Transfers',
        'Purchase Order Automation',
        'Batch & Serial Tracking',
        'Barcode Scanning',
        'Stock Valuation',
        'Reorder Automation',
    ],
    pricingPlans: defaultPricingPlans,
    faqItems: [
        {
            question: 'Can I manage stock across multiple warehouses?',
            answer: 'Yes. The platform gives you real-time visibility and control across every warehouse and branch from a single dashboard.',
        },
        {
            question: 'Does it support barcode scanning?',
            answer: 'Yes, barcode scanning is supported for receiving, picking, and stock counts to speed up warehouse operations.',
        },
        {
            question: 'How does automated replenishment work?',
            answer: 'You set reorder points per item, and the system automatically generates purchase orders when stock falls below the threshold.',
        },
        {
            question: 'Can I track batches and serial numbers?',
            answer: 'Yes, full batch and serial number tracking is available for traceability and compliance requirements.',
        },
    ],
    ctaHeading: 'Ready to Take Control of Your Inventory?',
    ctaDescription:
        'Schedule a free consultation to see how our stock management solution can eliminate stockouts and reduce carrying costs.',
};

export const MainContent = () => <ModulePageContent config={config} />;
