import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: "Mobile Development", path: '/services/mobile-development' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: "iOS & Android Mobile App Development | UnityAlgo",
    description:
        "High-quality mobile applications for iOS and Android with intuitive interfaces, reliable performance and seamless experiences across modern devices.",
    keywords: ["Mobile App Development", "iOS App Development", "Android App Development", "React Native Development", "Flutter Development", "App Developers Pakistan"],
    path: '/services/mobile-development',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="mobile-development-breadcrumbs"
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
