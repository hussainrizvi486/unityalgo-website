'use client';

import { motion } from 'motion/react';

export interface ProjectFlowStage {
    number: string;
    title: string;
    description: string;
}

interface ProjectFlowProps {
    heading?: string;
    subheading?: string;
    stages: ProjectFlowStage[];
}

export function ProjectFlow({
    heading = 'Project Stages and Flow',
    subheading = 'Depending on your current project stage, we work out and suggest the most effective plan to achieve your goals.',
    stages,
}: ProjectFlowProps) {
    return (
        <section className="py-24 bg-ink-900 text-white relative overflow-hidden">
            <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-brand/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />

            <div className="container mx-auto px-4 max-w-6xl relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-16 max-w-2xl"
                >
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{heading}</h2>
                    <p className="text-ink-400">{subheading}</p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
                    {stages.map((stage, idx) => (
                        <motion.div
                            key={stage.number}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-ink-900 p-6 md:p-8"
                        >
                            <span className="text-white/80 font-bold text-sm tracking-widest">{stage.number}</span>
                            <h3 className="text-lg font-bold mt-3 mb-3">{stage.title}</h3>
                            <p className="text-sm text-ink-400 leading-relaxed">{stage.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
