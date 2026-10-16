import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Header, Footer } from '@/components/layouts';
import { generatePageMetadata } from '@/lib/metadata';

export const metadata: Metadata = generatePageMetadata({
    title: 'Services | UnityAlgo',
    description:
        'Explore UnityAlgo services: custom software development, cloud and DevOps engineering, web application development, and iOS and Android mobile apps.',
    keywords: ['UnityAlgo Services', 'Custom Software Development', 'Cloud & DevOps', 'Web Application Development', 'Mobile App Development'],
    path: '/services',
});

const services = [
    {
        name: 'Tailored Software Development',
        href: '/services/digital-product-engineering',
        description: 'Bespoke systems designed around how your business already works, built to hold up as it grows.',
    },
    {
        name: 'Cloud & DevOps',
        href: '/services/cloud-devops',
        description: 'Scalable cloud architecture, automated deployments and monitoring that catches problems first.',
    },
    {
        name: 'Web App Development',
        href: '/services/web-development',
        description: 'Secure, fast web applications with interfaces people work out without training.',
    },
    {
        name: 'Mobile Development',
        href: '/services/mobile-development',
        description: 'iOS and Android applications that feel native and hold up on the phones people actually own.',
    },
];

const Page = () => {
    return (
        <div className="bg-background text-foreground min-h-screen overflow-hidden">
            <Header />

            <main>
                <section className="relative pt-hero pb-section md:pb-section px-page">
                    <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_top,var(--scrim)_30%,transparent_70%)] opacity-30 pointer-events-none" />
                    <div className="site-container site-container-wide text-center relative z-10">
                        <h1 className="text-5xl md:text-6xl tracking-tight mb-6 text-balance">
                            Our Services
                        </h1>
                        <p className="text-xl text-foreground/70 max-w-2xl mx-auto leading-relaxed text-balance">
                            Software, infrastructure and applications built around how your business already works — and made to hold up as it grows.
                        </p>
                    </div>
                </section>

                <section className="pb-section px-page">
                    <div className="site-container site-container-wide grid md:grid-cols-2 lg:grid-cols-3 gap-gap-lg">
                        {services.map((service) => (
                            <Link
                                key={service.name}
                                href={service.href}
                                className="group p-8 rounded-2xl border border-border/60 hover:border-primary/25 hover:shadow-xl hover:shadow-foreground/5 transition-all duration-300"
                            >
                                <h2 className="text-xl text-foreground group-hover:opacity-75 transition-colors mb-3">
                                    {service.name}
                                </h2>
                                <p className="text-sm text-foreground/70 leading-relaxed mb-6">{service.description}</p>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
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
