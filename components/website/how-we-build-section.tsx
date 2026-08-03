'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { cn } from '@/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

type BuildRole = 'Human + AI' | 'AI' | 'Human';

interface BuildStage {
    number: string;
    title: string;
    role: BuildRole;
    description: string;
}

const stages: BuildStage[] = [
    {
        number: '01',
        title: 'Discover',
        role: 'Human + AI',
        description: 'Workshops and stakeholder interviews with AI in the room. It cross-verifies inputs across calls, docs, and Slack threads — flagging blind spots, edge cases, and contradictions humans miss.',
    },
    {
        number: '02',
        title: 'Plan',
        role: 'AI',
        description: 'AI decomposes the work, picks architecture, models, and tools. Surfaces risks, costs, trade-offs — and conflicts between stated requirements — before they become bugs.',
    },
    {
        number: '03',
        title: 'Align',
        role: 'Human',
        description: 'You review and approve. Every decision is logged — an auditable trail before any code is written. No black box, no scope drift.',
    },
    {
        number: '04',
        title: 'Build ',
        role: 'Human + AI',
        description: 'AI agents execute the approved plan inside engineered guardrails. Senior engineers steer and unblock. Sprint cadence with working artifacts, not status decks.',
    },
    {
        number: '05',
        title: 'Validate',
        role: 'Human + AI',
        description: 'Every release candidate passes three independent checks: automated evals, senior engineering review, and dedicated Human QA running manual and exploratory tests alongside security, performance, and accessibility audits.',
    },
    {
        number: '06',
        title: 'Release',
        role: 'Human + AI',
        description: 'We handle production deployment, UAT, knowledge transfer, and runbooks. Every cutover is documented, reversible, and scheduled on your approval — then your team takes the keys, or we keep operating it for you.',
    },
    {
        number: '07',
        title: 'Evolve',
        role: 'Human + AI',
        description: "Launch isn't the finish line — it's a milestone. Ongoing monitoring, feedback loops, and incremental improvements keep the system compounding, feeding straight back into the next discovery cycle.",
    },
];

const roleStyles: Record<BuildRole, string> = {
    'Human + AI': 'text-warning-500 border-warning-500/40',
    AI: 'text-warning-500 border-warning-500/40',
    Human: 'text-success-500 border-success-500/40',
};

function RoleBadge({ role }: { role: BuildRole }) {
    return (
        <span className={cn('shrink-0 text-xs font-medium px-3 py-1 rounded-full border', roleStyles[role])}>
            {role}
        </span>
    );
}

export function HowWeBuildSection() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
        };

        const scrollContainer = scrollRef.current;
        scrollContainer?.addEventListener('scroll', handleScroll);
        return () => scrollContainer?.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <section className="relative py-24 md:py-32 overflow-hidden bg-ink-950">
            <Image
                src="/images/how-we-build.jpg"
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-950/85 to-ink-950/30" />

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="lg:sticky lg:top-32"
                    >
                        <p className="text-xs font-semibold text-white/60 tracking-widest uppercase mb-4">How We Build</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6 text-balance">
                            A delivery method built for the AI era, not retrofitted to it.
                        </h2>
                        <p className="text-white/70 leading-relaxed text-balance">
                            Seven named stages. Continuous iteration. AI runs alongside us in every conversation — surfacing blind spots, edge cases, and contradictions before they become rework — while senior engineers and Human QA own the decisions that move risk and ship the product. You always know who is driving, what you&apos;re approving, and what comes next.
                        </p>
                    </motion.div>

                    <div className="relative">{/* wrapper made relative to position the absolute arrow button */}
                        {/* Scrollable list container */}
                        <div ref={scrollRef} className="flex flex-col gap-3 max-h-180 overflow-y-auto pr-2 scrollbar-none " onScroll={() => { /* handler assigned in effect */ }}>
                            {stages.map((stage, idx) => (
                                <motion.div
                                    key={stage.number}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.08, duration: 0.5 }}
                                    className={cn(
                                        'p-6 md:p-8 rounded-2xl',
                                        'bg-black/30 backdrop-blur-sm border border-white/10'
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className={cn('text-sm font-bold', roleStyles[stage.role].split(' ')[0])}>
                                                {stage.number}
                                            </span>
                                            <h3 className="text-xl font-bold text-white">{stage.title}</h3>
                                        </div>
                                        <RoleBadge role={stage.role} />
                                    </div>
                                    <p className="text-sm text-white/70 leading-relaxed">{stage.description}</p>
                                </motion.div>
                            ))}
                            <button
                                aria-label={isAtBottom ? 'Scroll to top' : 'Scroll to bottom'}
                                onClick={() => {
                                    if (!scrollRef.current) return;
                                    if (isAtBottom) {
                                        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                    } else {
                                        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                                    }
                                }}
                                className={cn(
                                    'absolute right-3 bottom-3 w-12 h-12 rounded-full flex items-center justify-center bg-white/8 border border-white/10 shadow-backdrop transition-transform',
                                    'hover:scale-105',
                                    !isAtBottom ? 'animate-bob' : ''
                                )}
                            >
                                {!isAtBottom ? (
                                    <ChevronDown size={20} className="text-white" />
                                ) : (
                                    <ChevronUp size={20} className="text-white" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
