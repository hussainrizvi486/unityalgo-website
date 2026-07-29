import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Accounting', path: '/services/accounting' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: 'Financial Management & Accounting Software | UnityAlgo',
    description:
        'Accelerate business outcomes with connected, automated finance operations. Financial closing, multi-entity accounting, reporting, and cost control in one platform.',
    keywords: [
        'Financial Management Software',
        'Accounting Software',
        'Finance Transformation',
        'Accounts Receivable Payable',
        'Asset Management',
        'Financial Reporting',
        'Budgeting and Forecasting',
        'Tax Compliance Software',
        'Multi-Entity Accounting',
        'UnityAlgo Accounting',
    ],
    path: '/services/accounting',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="accounting-breadcrumbs"
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
