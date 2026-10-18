'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

export interface OverviewOption {
    title: string;
    description: string;
    image: string;
}

interface SidebarOverviewProps {
    heading?: string;
    subheading?: string;
    options: OverviewOption[];
}

export function SidebarOverview({
    heading = 'Overview',
    subheading = 'Explore what this module can do for your business.',
    options,
}: SidebarOverviewProps) {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <section className="bg-card site-section-spacing">
            <div className="site-container site-gutters site-container-wide">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl mb-4">{heading}</h2>
                    <p className="text-foreground/70 max-w-2xl mx-auto">{subheading}</p>
                </motion.div>

                <div className="grid md:grid-cols-12 gap-gap-xl items-start">
                    {/* Sidebar options */}
                    <div className="md:col-span-4 flex flex-col divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden">
                        {options.map((option, idx) => {
                            const isActive = idx === activeIndex;
                            return (
                                <button
                                    key={option.title}
                                    onClick={() => setActiveIndex(idx)}
                                    aria-current={isActive ? 'true' : undefined}
                                    className={cn(
                                        'w-full text-left px-6 py-5 transition-colors flex items-center justify-between gap-3',
                                        'border-l-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:relative',
                                        isActive
                                            ? 'border-l-ink-900 bg-muted text-foreground'
                                            : 'border-l-transparent bg-card text-foreground/70 hover:bg-muted/70 hover:text-foreground'
                                    )}
                                >
                                    <span className="font-semibold text-sm md:text-base">{option.title}</span>
                                    <ChevronDown
                                        className={cn(
                                            'w-4 h-4 shrink-0 transition-transform md:hidden',
                                            isActive && 'rotate-180'
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* Active option detail */}
                    <div className="md:col-span-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="rounded-xl overflow-hidden border border-border/60"
                            >
                                <div className="aspect-16/9 bg-secondary relative">
                                    <Image
                                        src={options[activeIndex].image}
                                        alt={options[activeIndex].title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 60vw"
                                    />
                                </div>
                                <div className="p-6 md:p-8">
                                    <h3 className="text-xl text-foreground mb-3">
                                        {options[activeIndex].title}
                                    </h3>
                                    <p className="text-foreground/70 leading-relaxed">
                                        {options[activeIndex].description}
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
}
