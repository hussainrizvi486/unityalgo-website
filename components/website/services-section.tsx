/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import {
    MessageSquare, Zap, PersonStanding, Check, ArrowUpRight,
    ShoppingCart, Factory, HeartPulse, GraduationCap, Building2,
    Car, Truck, Landmark, Cpu, Briefcase,
    type LucideIcon,
} from "lucide-react";
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { motion } from 'motion/react';
import { cn } from '@/utils';

interface ServiceType {
    title: string;
    description: string;
    image: string;
    width?: number;
    languages: string[];
    link?: string;
}

interface FeatureType {
    icon: LucideIcon;
    title: string;
    desc: string;
    color: string;
    rotate: string;
}

const features: FeatureType[] = [
    {
        icon: Zap,
        title: 'Product-Oriented Approach',
        desc: 'We think like product owners, not just vendors. We research your users, challenge assumptions, and help you prioritize features that move the metrics that matter.',
        color: 'bg-orange-600',
        rotate: '-rotate-3',
    },
    {
        icon: PersonStanding,
        title: 'AI-First by Default',
        desc: 'Every project runs on our Production-Ready AI Engineering practice — senior engineers paired with AI agents, shipping faster without lowering the bar. AI is the engine, not the marketing.',
        color: 'bg-amber-600',
        rotate: 'rotate-2',
    },
    {
        icon: MessageSquare,
        title: 'Clear Communication',
        desc: 'We build relationships on integrity and trust, with transparent processes and proactive communication at every stage of the work.',
        color: 'bg-rose-600',
        rotate: '-rotate-2',
    },
    {
        icon: PersonStanding,
        title: 'Customer-Centric Approach',
        desc: 'We start from your business goals, not our tech stack, and deliver tailored solutions that drive measurable impact for your team and customers.',
        color: 'bg-red-500',
        rotate: 'rotate-3',
    },
];

const data: Array<ServiceType> = [
    {
        title: "AI-Native Software Engineering",
        description:
            "End-to-end AI-native web, mobile, and SaaS products with intelligence embedded throughout—from conversational interfaces and recommendation engines to agent-driven workflows and rescued AI-generated codebases.",
        image: "/images/icons/ai.png",
        link: "/services/ai-native-software-engineering",
        languages: ["AI-Native", "SaaS", "Web", "Mobile", "Vibecode Rescue"],
    },
    {
        title: "ERP Systems",
        description:
            "Custom ERP solutions that unify business processes, automate workflows, and provide real-time visibility across finance, inventory, sales, and operations.",
        image: "/images/icons/erp.jpeg",
        link: "/services/erp-software",
        languages: ["ERP", "Python", "Golang", "SQL"],
    },
    {
        title: "Web App Development",
        description:
            "Secure, scalable, and high-performance web applications engineered around your business requirements, users, and long-term growth objectives.",
        image: "/images/icons/web-development.png",
        link: "/services/web-development",
        languages: ["Full Stack", "React", "Django", "Cloud"],
        width: 40,
    },
    {
        title: "Mobile Development",
        description:
            "High-quality mobile applications with intuitive interfaces, reliable performance, and seamless experiences across iOS and Android devices.",
        image: "/images/icons/mobile-development.png",
        link: "/services/mobile-development",
        languages: ["React Native", "Flutter", "iOS", "Android"],
    },

];

export const Services = () => {
    return (
        <section className="relative min-h-screen bg-ink-50 text-foreground py-24 overflow-hidden" id="services">


            <div className="absolute inset-0 bg-grid-pattern mask-[linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] opacity-30 pointer-events-none" />

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="mb-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15 mb-6"
                    >
                        <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                        <span className="text-xs font-semibold text-brand tracking-wide uppercase">OUR SERVICES</span>
                    </motion.div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight  mb-6">
                        Building Digital Products That Matter
                    </h2>
                    <p className="text-lg text-ink-600 leading-relaxed text-balance">
                        From strategy and design to development and deployment, we create reliable digital solutions that drive measurable business results.                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-32">
                    {data.map((service, index) => (
                        <ServiceCard key={index} {...service} index={index} />
                    ))}
                </div>

                {/* Industries Pills */}
                <div className="mb-32 text-center">
                    <p className="text-base font-bold uppercase tracking-widest mb-8">Industries We Serve</p>
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-5xl mx-auto">
                        {[
                            { name: "Retail & E-commerce", icon: ShoppingCart },
                            { name: "Manufacturing", icon: Factory },
                            { name: "Healthcare", icon: HeartPulse },
                            { name: "Education", icon: GraduationCap },
                            { name: "Real Estate", icon: Building2 },
                            { name: "Automotive", icon: Car },
                            { name: "Logistics & Supply Chain", icon: Truck },
                            { name: "Financial Services", icon: Landmark },
                            { name: "IT & Technology", icon: Cpu },
                            { name: "Professional Services", icon: Briefcase },
                        ].map((industry, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="px-5 py-3 rounded-full text-sm font-medium  cursor-default flex items-center gap-2"
                            >
                                <industry.icon className="w-4 h-4 opacity-70" />
                                <span>{industry.name}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>


                <div className="relative">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl font-bold ">
                            How UnityAlgo Drives Your Success
                        </h3>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 py-6">
                        {features.map((feature, index) => (
                            <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
                        ))}
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
            className="group relative p-8 rounded-2xl bg-white hover:shadow-sm hover:cursor-pointer transition-all duration-300"
        >
            <div className="flex flex-col-reverse md:flex-row md:items-start gap-6">
                <div className="flex-1 z-10">
                    <h3 className="text-2xl font-bold text-ink-900 mb-3 transition-colors">
                        {props.title}
                    </h3>
                    <p className="text-sm text-ink-600 leading-relaxed mb-6">
                        {props.description}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-8">
                        {props.languages.map((val, index) => (
                            <span key={index} className="px-2.5 py-0.5 text-xs font-bold bg-ink-50 rounded-full">
                                {val}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button className="py-1.5 h-[\auto] text-xs rounded-md font-bold text-white bg-brand ">
                            Let's Chat
                        </Button>
                        {props.link && (
                            <Link href={props.link}>
                                <Button variant="ghost" className="py-1.5 h-[\auto] text-xs rounded-md font-bold text-ink-600 hover:bg-secondary">
                                    Learn more <ArrowUpRight className="ml-1 w-4 h-4" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="relative shrink-0 md:w-50">
                    <img
                        src={props.image}
                        alt={props.title}
                        // width={160}
                        // height={160}
                        className={cn("object-contain ml-auto", props.width ? `w-${props.width}`: "")} />
                </div>
            </div>
        </motion.div>
    );
}

const FeatureCard = ({ icon: Icon, title, desc, color, rotate, delay }: FeatureType & { delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay }}
        className={cn(
            'group relative p-8 rounded-3xl shadow-lg cursor-pointer transition-transform duration-300 hover:rotate-0 hover:z-10',
            color,
            rotate
        )}
    >
        <div className="relative w-12 h-12 mb-8">
            <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <Check className="w-3 h-3 text-ink-900" strokeWidth={3} />
            </span>
        </div>
        <h4 className="text-xl font-bold text-white mb-3">{title}</h4>
        <p className="text-sm text-white/80 leading-relaxed">
            {desc}
        </p>
    </motion.div>
)