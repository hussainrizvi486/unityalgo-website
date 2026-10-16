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
        <section className="bg-background site-section-spacing">
            <div className="site-container site-gutters site-container-wide">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl mb-4">{heading}</h2>
                    {subheading && <p className="text-foreground/70 max-w-2xl mx-auto">{subheading}</p>}
                </motion.div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-gap">
                    {features.map((feature, idx) => (
                        <motion.div
                            key={feature}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-3 p-card rounded-xl border border-border/60 hover:border-input hover:bg-muted transition-colors"
                        >
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                            <span className="text-sm font-medium text-foreground">{feature}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
