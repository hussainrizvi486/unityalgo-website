'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, Zap, Layers } from 'lucide-react';
import { Globe } from '@/components/globe';

export function HeroSection() {
    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 500], [0, 200]);
    const globeY = useTransform(scrollY, [0, 500], [0, 100]);

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: (e.clientX - window.innerWidth / 2) / 20,
                y: (e.clientY - window.innerHeight / 2) / 20
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">

            {/* --- BACKGROUND LAYERS --- */}

            {/* 1. Tech Grid */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-40" />
            </div>

            {/* 2. Ambient Red/Blue Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    style={{ x: mousePosition.x * -1, y: mousePosition.y * -1 }}
                    className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] bg-brand-500/10 rounded-full blur-[100px] mix-blend-multiply animate-blob"
                />
                <motion.div
                    style={{ x: mousePosition.x, y: mousePosition.y }}
                    className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] mix-blend-multiply animate-blob animation-delay-2000"
                />
            </div>

            {/* --- THE 3D GLOBE (Positioned absolutely behind the content) --- */}
            <motion.div
                style={{ y: globeY }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute z-0 top-[15%] md:top-[10%] opacity-40 md:opacity-100 pointer-events-none"
            >
                {/* We wrap it in a div that fades out at the bottom so it blends into the footer area */}
                <div className="relative">
                    <Globe className="w-[500px] h-[500px] md:w-[800px] md:h-[800px]" />
                    {/* Fade Mask */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
                </div>
            </motion.div>


            {/* --- MAIN TEXT CONTENT --- */}
            <div className="container relative z-10 px-4 mx-auto text-center">

                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center mb-8"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-brand-500/10 shadow-sm backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                        </span>
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            Global Tech Solutions
                        </span>
                    </div>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="relative max-w-5xl mx-auto text-5xl md:text-7xl font-bold tracking-tight text-brand-900 mb-6 text-balance leading-[1.1]"
                >
                    Empowering Business with <br className="hidden md:block" />
                    <span className="bg-linear-to-r from-brand-500 via-brand-600 to-brand-900 bg-clip-text ">
                        Intelligent Web Solutions
                    </span>
                </motion.h1>

                {/* Subtext */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                    className="relative max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-10 text-balance backdrop-blur-sm"
                >
                    We engineer scalable digital ecosystems that drive transformation.
                    Connect with a global network of innovation.
                </motion.p>

                {/* Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
                >
                    <Button
                        size="lg"
                        className="h-12 px-8 text-base bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
                    >
                        Get Started <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => scrollToSection('services')}
                        className="h-12 px-8 text-base bg-white/60 backdrop-blur-md border-gray-200 text-gray-800 hover:bg-white rounded-full transition-all"
                    >
                        Our Services
                    </Button>
                </motion.div>

                
                <motion.div
                    style={{ y: y1 }}
                    className="relative z-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12"
                >
                    {[
                        {
                            icon: Zap,
                            title: "Lightning Fast",
                            desc: "Optimized for speed and performance scores."
                        },
                        {
                            icon: ShieldCheck,
                            title: "Enterprise Secure",
                            desc: "Bank-grade security standards built-in."
                        },
                        {
                            icon: Layers,
                            title: "Infinite Scale",
                            desc: "Architecture that grows with your business."
                        }
                    ].map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 + (idx * 0.1) }}
                            className="glass p-6 rounded-2xl text-left group hover:-translate-y-2 transition-transform duration-300 bg-white/60 hover:bg-white/80 shadow-xl shadow-brand-900/5 border border-white/50"
                        >
                            <div className="w-12 h-12 rounded-xl bg-brand-50/80 flex items-center justify-center mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                                <item.icon className="w-6 h-6 text-brand-600 group-hover:text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

        </section>
    );
}