'use client';

import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

interface FeaturesGridProps {
    heading?: string;
    subheading?: string;
    features: string[];
}

export function FeaturesGrid({
    heading = 'Features',
    subheading,
    features,
}: FeaturesGridProps) {
    return (
        <section className="py-24 bg-background">
            <div className="container mx-auto px-4 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl font-bold  mb-4">{heading}</h2>
                    {subheading && <p className="text-gray-600 max-w-2xl mx-auto">{subheading}</p>}
                </motion.div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={feature}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-3 p-5 rounded-2xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
                        >
                            <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" />
                            <span className="text-sm font-medium text-gray-800">{feature}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
