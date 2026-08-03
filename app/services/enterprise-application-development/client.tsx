'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Clock, TrendingUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectFlow } from '@/components/website/project-flow';
import { FaqSection } from '@/components/website/faq-section';

const stages = [
    {
        number: '01',
        title: 'Initial Stage',
        description:
            "We ensure your project's success with careful planning. During the initial stage, we collaborate with you to align functionality, performance, and design. We define strategy, set priorities, and establish your budget and deadlines before starting work.",
    },
    {
        number: '02',
        title: 'Design Stage',
        description:
            "After developing a prototype wireframe, our design team starts to create your application style (the app's \"look and feel\"). In this stage, we provide you with a full set of UI screens to use for further development.",
    },
    {
        number: '03',
        title: 'Development Stage',
        description:
            'Product development progresses through multiple releases, including an MVP. We use Agile sprints to speed up the process, running development alongside wireframes, documentation, and mockups.',
    },
    {
        number: '04',
        title: 'Ongoing Development, Support & Maintenance',
        description:
            'After releasing the MVP, our team performs new sprints to speed new releases with additional functionality. And we support and maintain the latest version of the launched app.',
    },
];

const faqItems = [
    {
        question: 'What engagement models do you offer?',
        answer: 'We offer both Time & Materials and Agile fixed-scope engagements, so you can choose the model that best fits your risk tolerance and how well-defined your requirements are.',
    },
    {
        question: 'How long does a typical enterprise application project take?',
        answer: 'Timelines vary by scope, but most projects deliver an MVP within a few months, followed by iterative sprints that add functionality based on real user feedback.',
    },
    {
        question: 'What technology stack do you use?',
        answer: 'We select the stack based on your requirements and existing systems, with strong expertise in modern web, ERP, and cloud-native architectures.',
    },
    {
        question: 'Do you provide ongoing support after launch?',
        answer: 'Yes, our ongoing development, support, and maintenance stage keeps your application secure, up to date, and evolving with new functionality after launch.',
    },
];

export const MainContent = () => {
    return (
        <>
            {/* --- HERO SECTION (full background image) --- */}
            <section className="relative min-h-[100vh] flex items-center pt-32 pb-20 px-4 overflow-hidden">
                <div className="absolute inset-0">
                    <Image
                        src="/images/enterprise-application-development.png"
                        alt="Enterprise Application Development"
                        fill
                        className="object-cover"
                        priority
                    />
                    {/* <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/40" /> */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/30 to-black/1" />
                </div>

                <div className="container mx-auto max-w-6xl relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-2xl text-white"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 text-balance">
                            Enterprise Application Development
                        </h1>
                        <p className="text-xl text-ink-200 leading-relaxed text-balance mb-10">
                            UnityAlgo builds and improves enterprise applications to help scale your business, offering expert design, development, and support services.
                        </p>

                        <Link href="/#contact">
                            <Button size="lg" className="rounded-full bg-brand hover:brightness-90 text-white px-8 h-12 text-base shadow-lg shadow-brand/20">
                                Let&apos;s Chat
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* --- PROJECT FLOW SECTION --- */}
            <ProjectFlow stages={stages} />

            {/* --- DEVELOPMENT FORMATS & BILLING --- */}
            <section className="py-24 bg-ink-50">
                <div className="container mx-auto px-4 max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl font-bold ">Development Formats and Billing</h2>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="bg-white p-8 md:p-10 rounded-3xl border border-ink-100"
                        >
                            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6 text-brand">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-ink-900 mb-4">Time & Materials</h3>
                            <p className="text-ink-600 leading-relaxed">
                                An exceptional, user-friendly front-end environment requires agile, flexible ideation, and an ability to pivot and adapt according to changing needs. With our &apos;time and materials&apos; approach, you won&apos;t need to overpay for risk contingencies you may not need.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="bg-white p-8 md:p-10 rounded-3xl border border-ink-100"
                        >
                            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6 text-brand">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-ink-900 mb-4">Agile</h3>
                            <p className="text-ink-600 leading-relaxed">
                                We believe in Agile development. Agile front-end development involves the use of a series of short sprints, which allow for quick and transparent progress in your project. We apply our nimble and responsive ideologies to each project, rather than relying on the restrictive linear Waterfall approach, resulting in a flexible solution that earns your approval at every stage.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* --- FAQ SECTION --- */}
            <FaqSection items={faqItems} />

            {/* --- CTA --- */}
            <section className="py-24 bg-gradient-to-br from-ink-950 to-black text-white text-center px-4">
                <div className="container mx-auto max-w-3xl">
                    <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Layers className="w-7 h-7" />
                    </div>
                    <h2 className="text-4xl font-bold mb-6">Have a Project in Mind?</h2>
                    <p className="text-ink-300 mb-8 max-w-2xl mx-auto">
                        Let&apos;s talk through your goals and find the most effective plan to launch or evolve your enterprise application.
                    </p>
                    <Link href="/#contact">
                        <Button size="lg" className="bg-white text-ink-600 hover:bg-ink-100 rounded-full px-8 h-12">
                            Let&apos;s Chat
                        </Button>
                    </Link>
                </div>
            </section>
        </>
    );
};
