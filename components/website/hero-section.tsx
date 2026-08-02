'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, Zap, Layers, BrainCircuit, Rocket } from 'lucide-react';
import { WavyBackground } from '@/components/website/wavy-background';

export function HeroSection() {
    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
            <WavyBackground className="z-0 pointer-events-none" />

            <div className='container'>

                <div className="relative z-10 px-4">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-4"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-brand/10 shadow-sm backdrop-blur-md">
                            <Rocket className="relative flex size-4 stroke-brand" />
                            <span className="text-xs uppercase tracking-wide">
                                Built for Tomorrow
                            </span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="relative text-3xl md:text-5xl font-bold tracking-tight  mb-5 text-balance leading-[1.1]"
                    >
                        AI-Powered Software. <br />
                        Built Smarter.<br />
                        Driving  Innovation every day.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                        className="relative text-ink-600 mb-6 text-balance backdrop-blur-sm"
                    >
                        We build AI-powered web, mobile, and enterprise software that streamlines <br /> operations, accelerates growth, and helps businesses stay ahead in a rapidly evolving digital world.
                    </motion.p>


                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row gap-4 items-center mb-10h"
                    >
                        <Button
                            size="lg"
                            className="text-xs sm:h-12 sm:text-base bg-brand hover:brightness-90 text-white rounded-full shadow-lg shadow-brand/25 transition-all hover:scale-105"
                        >
                            Get Started <ArrowRight className="ml-1 size-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => scrollToSection('services')}

                            className="px-8 text-xs sm:h-12 sm:text-base bg-white/60 backdrop-blur-md shadow-md border-input hover:bg-white rounded-full transition-all"
                        >
                            Our Services
                        </Button>
                    </motion.div>

                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-12"
                    >
                        {[
                            {
                                icon: BrainCircuit,
                                title: "Enterprise Resource Planning (ERP)",
                                desc: "Integrated ERP solutions that streamline operations, automate workflows, and improve business efficiency."
                            },
                            {
                                icon: ShieldCheck,
                                title: "AI-Native Software Engineering",
                                desc: "Build intelligent, AI-first applications with modern architectures, automation, and scalable development practices."
                            },
                            {
                                icon: Layers,
                                title: "Tailored Software Solutions",
                                desc: "Tailor-made software solutions designed to meet your unique business needs with scalability and long-term reliability."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-8 rounded-2xl shadow-sm border border-ink-100 bg-transparent"
                            >

                                <div className='mb-6 h-32'>
                                    <h3 className="text-xl font-bold text-ink-900 mb-2">{item.title}</h3>
                                    <p className="text-sm text-ink-500 leading-relaxed">{item.desc}</p>
                                </div>


                                <div className="flex items-center justify-between">
                                    <div>
                                        <item.icon className="w-12 h-12 text-ink-900 stroke-1.5" />
                                    </div>

                                    <Link className='bg-accent rounded-full p-2 hover:cursor-pointer' href={"/"}>
                                        <ArrowRight className='size-4' />
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
