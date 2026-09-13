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
        <section className="py-24 bg-white">
            <div className="container mx-auto px-4 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl font-bold  mb-4">{heading}</h2>
                    <p className="text-ink-600 max-w-2xl mx-auto">{subheading}</p>
                </motion.div>

                <div className="grid md:grid-cols-12 gap-8 items-start">
                    {/* Sidebar options */}
                    <div className="md:col-span-4 flex flex-col divide-y divide-ink-100 border border-ink-100 rounded-xl overflow-hidden">
                        {options.map((option, idx) => {
                            const isActive = idx === activeIndex;
                            return (
                                <button
                                    key={option.title}
                                    onClick={() => setActiveIndex(idx)}
                                    aria-current={isActive ? 'true' : undefined}
                                    className={cn(
                                        'w-full text-left px-6 py-5 transition-colors flex items-center justify-between gap-3',
                                        // Selection is carried by weight, ink and a
                                        // leading rule rather than a colour wash. A
                                        // tinted fill on the selected row reads as a
                                        // warning or an error, and pairs badly with
                                        // the focus ring landing on top of it.
                                        'border-l-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:relative',
                                        isActive
                                            ? 'border-l-ink-900 bg-ink-50 text-ink-950'
                                            : 'border-l-transparent bg-white text-ink-600 hover:bg-ink-50/70 hover:text-ink-900'
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
                                className="rounded-xl overflow-hidden border border-ink-100"
                            >
                                <div className="aspect-[16/9] bg-ink-100 relative">
                                    <Image
                                        src={options[activeIndex].image}
                                        alt={options[activeIndex].title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 60vw"
                                    />
                                </div>
                                <div className="p-6 md:p-8">
                                    <h3 className="text-xl font-bold text-ink-900 mb-3">
                                        {options[activeIndex].title}
                                    </h3>
                                    <p className="text-ink-600 leading-relaxed">
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
