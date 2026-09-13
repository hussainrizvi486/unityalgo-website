import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: "Web App Development", path: '/services/web-development' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: "Web Application Development Services | UnityAlgo",
    description:
        "Secure, scalable web applications with fast performance, intuitive interfaces and architecture built for long-term growth. React, Next.js, Django and cloud.",
    keywords: ["Web Application Development", "React Development", "Next.js Development", "Django Development", "Full Stack Development", "Web App Company Pakistan"],
    path: '/services/web-development',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="web-development-breadcrumbs"
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
