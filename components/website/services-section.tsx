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
        color: 'bg-primary',
        rotate: '-rotate-3',
    },
    {
        icon: PersonStanding,
        title: 'AI-First by Default',
        desc: 'Every project runs on our Production-Ready AI Engineering practice — senior engineers paired with AI agents, shipping faster without lowering the bar. AI is the engine, not the marketing.',
        color: 'bg-primary',
        rotate: 'rotate-2',
    },
    {
        icon: MessageSquare,
        title: 'Clear Communication',
        desc: 'We build relationships on integrity and trust, with transparent processes and proactive communication at every stage of the work.',
        color: 'bg-primary/90',
        rotate: '-rotate-2',
    },
    {
        icon: PersonStanding,
        title: 'Customer-Centric Approach',
        desc: 'We start from your business goals, not our tech stack, and deliver tailored solutions that drive measurable impact for your team and customers.',
        color: 'bg-primary',
        rotate: 'rotate-3',
    },
];

const data: Array<ServiceType> = [
    {
        title: "Tailored Software Development",
        description:
            "Design and build tailored software products that solve complex business challenges with scalable architecture, modern technology, and long-term flexibility.",
        image: "/images/icons/ai_development.png",
        link: "/services/digital-product-engineering",
        languages: ["SaaS", "Platforms", "APIs", "Automation", "AI"],
    },
    {
        title: "Cloud & DevOps",
        description:
            "Modernize your infrastructure with scalable cloud architecture, automated deployments, reliable CI/CD pipelines, monitoring, and secure DevOps practices.",
        image: "/images/icons/devops_icon.png",
        link: "/services/cloud-devops",
        languages: ["AWS", "Docker", "Kubernetes", "CI/CD"],
    },
    {
        title: "Web App Development",
        description:
            "Build secure, scalable web applications tailored to your business, with fast performance, intuitive experiences, and architecture made for long-term growth.",
        image: "/images/icons/web_icon.png",
        link: "/services/web-development",
        languages: ["Full Stack", "React", "Django", "Cloud"],
        width: 40,
    },
    {
        title: "Mobile Development",
        description:
            "Create high-quality mobile applications for iOS and Android with intuitive interfaces, reliable performance, and seamless experiences across modern devices.",
        image: "/images/icons/app_icon.png",
        link: "/services/mobile-development",
        languages: ["React Native", "Flutter", "iOS", "Android"],
    },
];


export const Services = () => {
    return (
        <section className="relative min-h-screen bg-muted text-foreground overflow-hidden site-section-spacing" id="services">


            <div className="absolute inset-0 bg-grid-pattern mask-[linear-gradient(to_bottom,transparent,var(--scrim)_10%,var(--scrim)_90%,transparent)] opacity-30 pointer-events-none" />

            <div className="site-container relative z-10 site-gutters">
                <div className="mb-20 text-center max-w-3xl mx-auto">
     
                    <h2 className="text-4xl md:text-5xl tracking-tight mb-6">
                        What We Provide
                    </h2>
                    <p className="text-lg text-foreground/70 leading-relaxed text-balance">
                        Comprehensive solutions tailored to your business needs.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-32">
                    {data.map((service, index) => (
                        <ServiceCard key={index} {...service} index={index} />
                    ))}
                </div>

                {/* Industries Pills */}
                <div className="mb-32 text-center">
                    <p className="text-base font-bold uppercase tracking-widest mb-8">Industries We Serve</p>
                    <div className="flex flex-wrap justify-center gap-3 md:gap-gap max-w-wide mx-auto">
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
                                className="px-5 py-3 rounded-full text-sm font-medium cursor-default flex items-center gap-2"
                            >
                                <industry.icon className="w-4 h-4 opacity-70" />
                                <span>{industry.name}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>


                <div className="relative">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl ">
                            How UnityAlgo Drives Your Success
                        </h3>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gap-lg py-6">
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
    const width = props.index == 0 ? "w-32": "w-40"
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: props.index * 0.1 }}
            className="group relative p-8 rounded-xl bg-card hover:shadow-sm hover:cursor-pointer transition-all duration-300"
        >
            <div className="flex flex-col-reverse md:flex-row md:items-start gap-gap-lg">
                <div className="flex-1 z-10">
                    <h3 className="text-2xl text-foreground mb-3 transition-colors">
                        {props.title}
                    </h3>
                    <p className="text-sm text-foreground/70 leading-relaxed mb-6">
                        {props.description}
                    </p>

                    <div className="flex gap-2 flex-wrap mb-8">
                        {props.languages.map((val, index) => (
                            <span key={index} className="px-2.5 py-0.5 text-micro font-bold bg-muted rounded-full">
                                {val}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button className="py-1.5 h-auto text-xs rounded font-bold text-primary-foreground bg-primary hover:bg-primary/90">
                            Let&apos;s Chat
                        </Button>
                        {props.link && (
                            <Button asChild variant="ghost" className="py-1.5 h-auto text-xs rounded font-bold text-foreground/70 hover:bg-secondary"><Link href={props.link}>
                                    Learn more <ArrowUpRight className="ml-1 w-4 h-4" />
                                </Link></Button>
                        )}
                    </div>
                </div>

                <div className="relative shrink-0 md:w-50">
                    {}
                    <Image
                        src={props.image}
                        alt={props.title}
                        width={200}
                        height={200}
                        sizes="200px"
                        className={cn("object-contain ml-auto h-auto", width)}
                    />
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
            'group relative p-8 rounded-2xl shadow-lg cursor-pointer transition-transform duration-300 hover:rotate-0 hover:z-10',
            color,
            rotate
        )}
    >
        <div className="relative w-12 h-12 mb-8">
            <Icon className="w-12 h-12 text-primary-foreground" strokeWidth={1.5} />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card flex items-center justify-center">
                <Check className="w-3 h-3 text-foreground" strokeWidth={3} />
            </span>
        </div>
        <h4 className="text-xl text-primary-foreground mb-3">{title}</h4>
        <p className="text-sm text-primary-foreground/80 leading-relaxed">
            {desc}
        </p>
    </motion.div>
)