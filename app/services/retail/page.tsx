import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Retail', path: '/services/retail' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: 'Retail & Point of Sale Software | UnityAlgo',
    description:
        'Run a modern point of sale, manage multi-store inventory, and unify online and in-store sales with UnityAlgo retail software.',
    keywords: [
        'Retail Management Software',
        'Point of Sale Software',
        'POS System',
        'Multi-Store Inventory',
        'Omnichannel Retail Software',
        'UnityAlgo Retail',
    ],
    path: '/services/retail',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="retail-breadcrumbs"
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
