'use client';

import { ModulePageContent, ModulePageConfig } from '@/components/website/module-page-content';
import { defaultPricingPlans } from '@/lib/default-pricing';

// placeholder copy — replace with real content
const config: ModulePageConfig = {
    badge: 'Manufacturing',
    heading: 'Manufacturing Operations',
    subheading:
        'Plan production, manage bills of materials, and track work orders from raw material to finished goods in one connected system.',
    heroImage: '/images/erp-development.png',
    overviewOptions: [
        {
            title: 'Production Planning',
            description:
                'Plan production runs against demand and capacity, and keep every work center synchronized with a live schedule.',
            image: '/images/erp-dashboard.png',
        },
        {
            title: 'Bill of Materials Management',
            description:
                'Maintain multi-level BOMs with accurate costing, so every product build reflects real material and labor costs.',
            image: '/images/erp-listview.png',
        },
        {
            title: 'Work Order Tracking',
            description:
                'Track work orders from raw material issue to finished goods, with full visibility into progress and bottlenecks.',
            image: '/images/erp-workspace.png',
        },
        {
            title: 'Quality & Compliance',
            description:
                'Enforce quality checks at each production stage and maintain audit-ready compliance records.',
            image: '/images/erp-pos.png',
        },
    ],
    features: [
        'Production Planning',
        'Bill of Materials (BOM)',
        'Work Order Management',
        'Shop Floor Tracking',
        'Capacity Planning',
        'Quality Control',
        'Cost Tracking',
        'Subcontracting Management',
    ],
    pricingPlans: defaultPricingPlans,
    faqItems: [
        {
            question: 'Can it manage multi-level bills of materials?',
            answer: 'Yes, the platform supports multi-level BOMs with accurate real-time costing across raw materials, sub-assemblies, and labor.',
        },
        {
            question: 'How is production capacity planned?',
            answer: 'Production schedules are built against work center capacity, so you can see bottlenecks and rebalance load before they impact delivery dates.',
        },
        {
            question: 'Does it support subcontracted manufacturing?',
            answer: 'Yes, subcontracting workflows let you send materials to external vendors and track returned finished or semi-finished goods.',
        },
        {
            question: 'Can I track quality checks during production?',
            answer: 'Quality control checkpoints can be configured at any stage of the work order, with audit-ready records for compliance.',
        },
    ],
    ctaHeading: 'Ready to Streamline Your Production Floor?',
    ctaDescription:
        'Schedule a free consultation to see how our manufacturing solution can improve throughput and reduce production costs.',
};

export const MainContent = () => <ModulePageContent config={config} />;
