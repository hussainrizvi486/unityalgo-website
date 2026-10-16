'use client';

import { motion } from 'motion/react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqItem {
    question: string;
    answer: string;
}

interface FaqSectionProps {
    heading?: string;
    subheading?: string;
    items: FaqItem[];
}

export function FaqSection({
    heading = 'Frequently Asked Questions',
    subheading = 'Everything you need to know before getting started.',
    items,
}: FaqSectionProps) {
    return (
        <section className="bg-card border-t border-border/60 site-section-spacing">
            <div className="site-container site-gutters site-container-reading">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl mb-4">{heading}</h2>
                    <p className="text-foreground/70">{subheading}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                >
                    <Accordion type="single" collapsible className="w-full">
                        {items.map((item, idx) => (
                            <AccordionItem key={idx} value={`item-${idx}`}>
                                <AccordionTrigger className="text-base text-foreground">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-foreground/70 leading-relaxed">
                                    {item.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </motion.div>
            </div>
        </section>
    );
}
