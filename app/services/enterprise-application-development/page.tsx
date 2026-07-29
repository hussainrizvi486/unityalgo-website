import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Enterprise Application Development', path: '/services/enterprise-application-development' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: 'Enterprise Application Development Services | UnityAlgo',
    description:
        'UnityAlgo builds and improves enterprise applications to help scale your business, offering expert design, development, and support services.',
    keywords: [
        'Enterprise Application Development',
        'Custom Software Development',
        'Enterprise Software Development Company',
        'Agile Software Development',
        'Application Design and Development',
        'UnityAlgo Development Services',
    ],
    path: '/services/enterprise-application-development',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="enterprise-app-dev-breadcrumbs"
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
