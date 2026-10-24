import React from 'react';
import Script from 'next/script';
import { Header, Footer } from '@/components/layouts';
import { generateBreadcrumbJsonLd, generatePageMetadata } from '@/lib/metadata';
import { MainContent } from './client';
import { PlansSection } from '@/components/website/plans-section';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'AlgoSuite', path: '/products/algosuite' },
]);

export const metadata = generatePageMetadata({
    title: 'AlgoSuite | Connected Business Management',
    description:
        'Explore AlgoSuite, a connected business management platform in development by UnityAlgo. Discover planned finance, inventory, CRM, HR, and operations workflows.',
    keywords: [
        'AlgoSuite',
        'ERP Software',
        'Business Management Platform',
        'Enterprise Resource Planning',
        'UnityAlgo Products',
    ],
    path: '/products/algosuite',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="algosuite-breadcrumbs"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />
            <Header />
            <MainContent pricing={<PlansSection productSlug="algosuite" />} />
            <Footer />
        </div>
    );
};

export default Page;
