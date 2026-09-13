import React from 'react';
import { Header, Footer } from '@/components/layouts';
import { MainContent } from './client';
import Script from 'next/script';
import { Metadata } from 'next';
import { generatePageMetadata, generateBreadcrumbJsonLd } from '@/lib/metadata';

const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: "Cloud & DevOps", path: '/services/cloud-devops' },
]);

export const metadata: Metadata = generatePageMetadata({
    title: "Cloud Infrastructure & DevOps Services | UnityAlgo",
    description:
        "Scalable cloud architecture, automated CI/CD pipelines, container orchestration, monitoring and secure DevOps practices for growing businesses.",
    keywords: ["DevOps Services", "Cloud Infrastructure", "CI/CD Pipelines", "Kubernetes Consulting", "Docker Deployment", "Cloud Migration Pakistan"],
    path: '/services/cloud-devops',
});

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Script
                id="cloud-devops-breadcrumbs"
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
