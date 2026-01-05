/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { MessageSquare, Users, Zap, ArrowUpRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { motion } from 'motion/react';

interface ServiceType {
    title: string;
    description: string;
    image: string;
    languages: string[];
    link?: string;
}

const data: Array<ServiceType> = [
    {
        title: "ERP Systems",
        description: "Powerful ERP solutions using Frappe and ERPNext to streamline operations, improve efficiency, and gain real-time insights.",
        image: "/images/erp-development.png",
        link: "/services/erp-software",
        languages: ["Frappe", "ERPNext", "Python", "Integrations"],
    },
    {
        title: "Front-End Development",
        description: "We craft responsive, fast, and intuitive user interfaces using modern front-end frameworks. Seamless experiences across all devices.",
        image: "/images/frontend-development.png",
        languages: ["React", "Next.js", "TypeScript", "Tailwind"],
    },
    {
        title: "Back-End Development",
        description: "Robust, scalable, and high-performance back-end systems. We build the reliable infrastructure that powers complex logic.",
        image: "/images/backend-development.png",
        languages: ["Python", "Go", "Django", "PostgreSQL"],
    },
    {
        title: "Web App Development",
        description: "Secure and customized web applications tailored to your specific business objectives, leveraging cutting-edge tech.",
        image: "/images/web-development.png",
        languages: ["Full Stack", "React", "Django", "Cloud"],
    },

];

export const Services = () => {
    return (
        <section className="relative min-h-screen bg-background text-foreground py-24 overflow-hidden" id="services">


            <div className="absolute inset-0 bg-grid-pattern mask-[linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] opacity-30 pointer-events-none" />

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="mb-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6"
                    >
                        <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                        <span className="text-xs font-semibold text-brand-700 tracking-wide uppercase">What We Do</span>
                    </motion.div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-brand-900 mb-6">
                        Engineering Digital <br />
                        <span className="bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text ">Excellence</span>
                    </h2>
                    <p className="text-lg text-gray-600 leading-relaxed text-balance">
                        We don&apos;t just write code; we build the engines that power your business growth using industry-leading technologies.
                    </p>
                </div>

                {/* Service Cards Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-32">
                    {data.map((service, index) => (
                        <ServiceCard key={index} {...service} index={index} />
                    ))}
                </div>

                {/* Industries Pills */}
                <div className="mb-32 text-center">
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">Industries We Serve</p>
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-5xl mx-auto">
                        {[
                            { name: "Finance", icon: "💰" },
                            { name: "Technology", icon: "💻" },
                            { name: "Retail", icon: "🛍️" },
                            { name: "E-commerce", icon: "🛒" },
                            { name: "SaaS", icon: "☁️" },
                            { name: "Enterprise", icon: "📊" }
                        ].map((industry, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white/50 backdrop-blur-sm border border-gray-200 px-5 py-3 rounded-full text-sm font-medium hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-all cursor-default flex items-center gap-2"
                            >
                                <span className="text-base grayscale opacity-70">{industry.icon}</span>
                                <span>{industry.name}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>


                <div className="relative">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl font-bold text-brand-900">
                            The UnityAlgo Standard
                        </h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-2">
                        <FeatureCard
                            icon={MessageSquare}
                            title="Transparent Comms"
                            desc="We foster trust through radical openness. No jargon, just clear updates and honest timelines."
                            delay={0}
                        />
                        <FeatureCard
                            icon={Users}
                            title="Customer-First"
                            desc="We don't build for us, we build for you. Your business goals dictate every line of code we write."
                            delay={0.1}
                        />

                        <FeatureCard
                            icon={Zap}
                            title="Rapid Innovation"
                            desc="We stay on the bleeding edge of tech so you don't have to. Future-proof solutions, delivered fast."
                            delay={0.2}
                        />
                    </div>
                </div>

            </div>
        </section>
    )
}

const ServiceCard = (props: ServiceType & { index: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: props.index * 0.1 }}
            className="group relative bg-white/60 backdrop-blur-md border border-white/60 p-8 rounded-3xl overflow-hidden hover:bg-white hover:border-brand-100 hover:shadow-2xl hover:shadow-brand-900/5 transition-all duration-300"
        >
            <div className="flex flex-col-reverse md:flex-row md:items-start gap-6">
                <div className="flex-1 z-10">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-brand-600 transition-colors">
                        {props.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-6">
                        {props.description}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-8">
                        {props.languages.map((val, index) => (
                            <span key={index} className="px-2.5 py-1 text-xs font-medium bg-gray-100 rounded-full border border-gray-200 group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:border-brand-100 transition-colors">
                                {val}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button className="text-white bg-brand-600 shadow-md shadow-brand-500/20 rounded-md hover:bg-brand-700">
                            Start Project
                        </Button>
                        {props.link && (
                            <Link href={props.link}>
                                <Button variant="ghost" className="rounded-md hover:bg-gray-100 text-gray-600 group-hover:text-brand-600">
                                    Learn more <ArrowUpRight className="ml-1 w-4 h-4" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="relative shrink-0 md:w-40 md:h-40 flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 rounded-2xl group-hover:scale-105 transition-transform duration-500">

                    <Image
                        src={props.image}
                        alt={props.title}
                        width={160}
                        height={160}
                        className="object-contain drop-shadow-md"
                    />
                </div>
            </div>
        </motion.div>
    )
}

const FeatureCard = ({ icon: Icon, title, desc, delay }: { icon: any, title: string, desc: string, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay }}
        className="group p-6 py-12 rounded-md bg-white shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300"
    >
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-6 group-hover:bg-brand-600 transition-colors duration-300">
            <Icon className="w-7 h-7 text-brand-600 group-hover:text-white transition-colors" />
        </div>
        <h4 className="text-xl font-bold mb-3">{title}</h4>
        <p className="text-sm">
            {desc}
        </p>
    </motion.div>
)