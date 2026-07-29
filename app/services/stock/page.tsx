import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Stock', path: '/services/stock' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: 'Stock & Inventory Management Software | UnityAlgo',
    description:
        'Track inventory across every location in real time, automate replenishment, and eliminate stockouts with UnityAlgo stock management.',
    keywords: [
        'Stock Management Software',
        'Inventory Management System',
        'Warehouse Management',
        'Stock Transfers',
        'Barcode Scanning Software',
        'UnityAlgo Stock',
    ],
    path: '/services/stock',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="stock-breadcrumbs"
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
