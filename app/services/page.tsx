import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Header, Footer } from '@/components/layouts';
import { generatePageMetadata } from '@/lib/metadata';

export const metadata: Metadata = generatePageMetadata({
    title: 'Services | UnityAlgo',
    description:
        'Explore UnityAlgo services: ERP implementation, financial management, stock, manufacturing, retail modules, and enterprise application development.',
    keywords: ['UnityAlgo Services', 'ERP Modules', 'Enterprise Application Development', 'Business Software'],
    path: '/services',
});

const services = [
    {
        name: 'ERP',
        href: '/services/erp-software',
        description: 'The complete ERPNext-powered operating system for scaling businesses.',
    },
    {
        name: 'Accounting',
        href: '/services/accounting',
        description: 'Connected, automated finance operations from closing to consolidation.',
    },
    {
        name: 'Stock',
        href: '/services/stock',
        description: 'Real-time inventory visibility and automated replenishment across every location.',
    },
    {
        name: 'Manufacturing',
        href: '/services/manufacturing',
        description: 'Production planning, BOM management, and work order tracking in one system.',
    },
    {
        name: 'Retail',
        href: '/services/retail',
        description: 'Modern point of sale and multi-store inventory for omnichannel retail.',
    },
    {
        name: 'Enterprise Application Development',
        href: '/services/enterprise-application-development',
        description: 'Expert design, development, and support to build and scale custom applications.',
    },
];

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Header />

            <main>
                <section className="relative pt-40 pb-20 md:pt-52 md:pb-24 px-4">
                    <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-30 pointer-events-none" />
                    <div className="container mx-auto max-w-6xl text-center relative z-10">
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight  mb-6 text-balance">
                            Our Services
                        </h1>
                        <p className="text-xl text-ink-600 max-w-2xl mx-auto leading-relaxed text-balance">
                            End-to-end ERP modules and enterprise application development, built to scale with your business.
                        </p>
                    </div>
                </section>

                <section className="pb-24 px-4">
                    <div className="container mx-auto max-w-6xl grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service) => (
                            <Link
                                key={service.name}
                                href={service.href}
                                className="group p-8 rounded-3xl border border-ink-100 hover:border-brand/25 hover:shadow-xl hover:shadow-ink-900/5 transition-all duration-300"
                            >
                                <h2 className="text-xl font-bold text-ink-900 group-hover:opacity-75 transition-colors mb-3">
                                    {service.name}
                                </h2>
                                <p className="text-sm text-ink-600 leading-relaxed mb-6">{service.description}</p>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                                    Learn more <ArrowRight className="w-4 h-4" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Page;
