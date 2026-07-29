import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Manufacturing', path: '/services/manufacturing' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: 'Manufacturing Management Software | UnityAlgo',
    description:
        'Plan production, manage bills of materials, and track work orders from raw material to finished goods with UnityAlgo manufacturing software.',
    keywords: [
        'Manufacturing Software',
        'Production Planning Software',
        'Bill of Materials Management',
        'Work Order Tracking',
        'Shop Floor Management',
        'UnityAlgo Manufacturing',
    ],
    path: '/services/manufacturing',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="manufacturing-breadcrumbs"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />

            <Header />
            <MainContent />
            <Footer />
        </div>
    );
};

export default Page;
