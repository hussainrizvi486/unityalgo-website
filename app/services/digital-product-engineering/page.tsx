import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: "Tailored Software Development", path: '/services/digital-product-engineering' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: "Custom Software Development Company | UnityAlgo",
    description:
        "Design and build tailored software products with scalable architecture, modern technology and long-term flexibility. Custom SaaS, platforms, APIs and automation.",
    keywords: ["Custom Software Development", "Bespoke Software Pakistan", "SaaS Development", "Product Engineering", "API Development", "Business Automation"],
    path: '/services/digital-product-engineering',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="digital-product-engineering-breadcrumbs"
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
