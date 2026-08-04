import React from 'react';
import Script from 'next/script';
import { Header, Footer } from '@/components/layouts';
import { generateBreadcrumbJsonLd, generatePageMetadata } from '@/lib/metadata';
import { MainContent } from './client';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Unity Commerce', path: '/products/unitycommerce' },
]);

export const metadata = generatePageMetadata({
    title: 'Unity Commerce | Build and Manage Your Online Store',
    description:
        'Launch and manage your online store with professional themes, powerful commerce tools and complete control over your brand.',
    keywords: [
        'Unity Commerce',
        'E-commerce Platform Pakistan',
        'Online Store Builder',
        'E-commerce Website',
        'Store Management Software',
        'Online Store Pakistan',
    ],
    path: '/products/unitycommerce',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="unity-commerce-breadcrumbs"
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
