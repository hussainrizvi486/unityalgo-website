import React from 'react';
import Script from 'next/script';
import { Header, Footer } from '@/components/layouts';
import { generateBreadcrumbJsonLd, generatePageMetadata } from '@/lib/metadata';
import { MainContent } from './client';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'UnityERP', path: '/products/unityerp' },
]);

export const metadata = generatePageMetadata({
    title: 'UnityERP Coming Soon | UnityAlgo',
    description:
        'UnityERP is a complete business management platform for modern companies, currently under development by UnityAlgo.',
    keywords: [
        'UnityERP',
        'ERP Software',
        'Business Management Platform',
        'Enterprise Resource Planning',
        'UnityAlgo Products',
    ],
    path: '/products/unityerp',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="unityerp-breadcrumbs"
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
