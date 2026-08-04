'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import {
    ArrowLeft,
    BarChart3,
    Boxes,
    Building2,
    CheckCircle2,
    Clock3,
    Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const platformAreas = [
    { icon: BarChart3, label: 'Real-time insights' },
    { icon: Boxes, label: 'Connected operations' },
    { icon: Building2, label: 'Company-wide control' },
];

export const MainContent = () => {
    return (
        <main className="relative pt-36 md:pt-44 px-4 flex items-center">
            <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,black_25%,transparent_75%)] opacity-30 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto max-w-6xl relative z-10 pb-22">
                <div className="grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-brand/15 mb-7">
                            <Clock3 className="w-3.5 h-3.5 text-brand" />
                            <span className="text-xs font-semibold text-brand tracking-wide uppercase">Coming Soon</span>
                        </div>

                        <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 text-balance">
                            UnityERP
                        </h1>
                        <h2 className="text-2xl md:text-3xl font-semibold text-ink-700 mb-6">
                            Coming Soon
                        </h2>
                        <p className="text-xl text-ink-600 leading-relaxed text-balance mb-10 max-w-2xl">
                            A Complete Business Management Platform for Modern Companies.
                        </p>

                        <Link href="/">
                            <Button size="lg" className="rounded-full bg-brand hover:brightness-90 text-white px-8 h-12 text-base shadow-lg shadow-brand/20">
                                <ArrowLeft className="mr-1 w-4 h-4" /> Back To Home
                            </Button>
                        </Link>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="rounded-3xl bg-white border border-ink-200 shadow-2xl p-3">
                            <div className="rounded-2xl bg-ink-950 overflow-hidden p-6 md:p-8">
                                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                                            <Layers3 className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">UnityERP</div>
                                            <div className="text-xs text-ink-400">Business workspace</div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-white bg-white/10 rounded-full px-3 py-1">In development</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-6">
                                    <div className="col-span-2 rounded-2xl bg-white/5 border border-white/10 p-5">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <div className="text-xs text-ink-400 mb-2">Business overview</div>
                                                <div className="text-2xl font-bold text-white">One connected platform</div>
                                            </div>
                                            <CheckCircle2 className="w-6 h-6 text-white/70" />
                                        </div>
                                        <div className="flex items-end gap-2 h-16">
                                            {[38, 58, 45, 72, 62, 88, 78].map((height, index) => (
                                                <div
                                                    key={index}
                                                    className="flex-1 rounded-t-sm bg-brand"
                                                    style={{ height: `${height}%`, opacity: 0.45 + index * 0.07 }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {platformAreas.map((area) => (
                                        <div key={area.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 last:col-span-2">
                                            <area.icon className="w-5 h-5 text-white/70 mb-3" />
                                            <span className="text-sm font-medium text-ink-200">{area.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '72%' }}
                                            transition={{ duration: 1, delay: 0.7 }}
                                            className="h-full rounded-full bg-brand"
                                        />
                                    </div>
                                    <span className="text-xs text-ink-400">Building</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </main>
    );
};
