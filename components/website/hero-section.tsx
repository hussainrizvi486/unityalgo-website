'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Button } from '@/components/ui/button';
import { HeroBackdrop } from '@/components/website/hero-backdrop';
import { ArrowRight, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMediaQuery } from '@/lib/use-reduced-motion';
import { detectWebGL } from '@/lib/webgl';

const ConnectedSystemsCanvas = dynamic(
    () => import('@/components/website/connected-systems-canvas'),
    { ssr: false },
);

const GRAIN_URL =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

const headlineLines = [
    { text: 'SOFTWARE', accent: false },
    { text: 'REIMAGINED FOR', accent: false },
    { text: 'THE AI ERA.', accent: true },
];

const EXTRUDE_DEPTH = 0.055;
const EXTRUDE_STEP = 0.0055;
const EXTRUDE_STEPS = Math.round(EXTRUDE_DEPTH / EXTRUDE_STEP);

function extrude(side: string) {
    const layers = Array.from({ length: EXTRUDE_STEPS }, (_, i) => {
        const offset = ((i + 1) * EXTRUDE_STEP).toFixed(4);
        return `${offset}em ${offset}em 0 ${side}`;
    });
    layers.push('0.08em 0.1em 0.14em color-mix(in srgb, var(--foreground) 9%, transparent)');
    return layers.join(', ');
}

const INK_EXTRUDE = extrude('var(--input)');
const BRAND_EXTRUDE = extrude('color-mix(in srgb, var(--logo-primary) 38%, var(--background))');

function MagneticButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
    const ref = useRef<HTMLButtonElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.3 });
    const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.3 });

    function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
        y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
    }

    return (
        <motion.div className="w-full sm:w-auto [&>button]:w-full" style={{ x: springX, y: springY }}>
            <Button
                ref={ref}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className={className}
                {...props}
            >
                {children}
            </Button>
        </motion.div>
    );
}

export function HeroSection() {
    const wideEnough = useMediaQuery('(min-width: 1000px)');
    const [webglAvailable] = useState(detectWebGL);

    const showScene = wideEnough && webglAvailable;

    const scrollToSection = (id: string) => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    };

    return (
        <section className="relative flex min-h-180 items-center overflow-hidden bg-background px-page pb-section pt-hero lg:min-h-screen lg:pb-section lg:pt-hero">
            {}
            <HeroBackdrop />
            {showScene ? <ConnectedSystemsCanvas className="z-0 pointer-events-none" /> : null}
            
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-4 mix-blend-multiply"
                style={{ backgroundImage: `url("${GRAIN_URL}")` }}
            />

            {showScene ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-5 z-5 hidden w-36 xl:block 2xl:right-10"
                >
                    {[
                        { label: 'AI core', top: '24%' },
                        { label: 'Experience', top: '39%' },
                        { label: 'Applications', top: '54%' },
                        { label: 'Automation', top: '69%' },
                        { label: 'Data + cloud', top: '84%' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="absolute right-0 flex items-center gap-3"
                            style={{ top: item.top }}
                        >
                            <span className="h-px w-7 bg-logo-primary/45" />
                            <span className="whitespace-nowrap text-small font-semibold uppercase tracking-caps text-muted-foreground">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="site-container relative z-10 w-full">
                <div className="max-w-173 text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                        className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-logo-primary/20 bg-card/70 px-3 py-1.5 shadow-sm backdrop-blur-sm"
                    >
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-logo-primary opacity-40 motion-reduce:animate-none" />
                            <span className="relative inline-flex size-2 rounded-full bg-logo-primary" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-caps text-foreground/80">
                            AI-native product engineering
                        </span>
                    </motion.div>

                    <h1 className="mb-7 font-display text-display leading-none tracking-tighter [word-spacing:0.08em]">
                        {headlineLines.map((line, i) => (
                            <span key={line.text} className="-mb-(--descender) block overflow-hidden pb-(--descender)">
                                <motion.span
                                    initial={{ y: '110%' }}
                                    animate={{ y: '0%' }}
                                    transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                                    className={line.accent ? 'block text-logo-primary' : 'block text-foreground'}
                                    style={{ textShadow: line.accent ? BRAND_EXTRUDE : INK_EXTRUDE }}
                                >
                                    {line.text}
                                </motion.span>
                            </span>
                        ))}
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
                        className="mb-8 max-w-xl text-balance text-base leading-7 text-foreground/70 sm:text-lg sm:leading-8"
                    >
                        We design and build the AI, automation, and software that make your
                        business systems work as one — guided by senior engineers from first
                        decision to production.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.75, ease: 'easeOut' }}
                        className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start"
                    >
                        <MagneticButton
                            size="lg"
                            onClick={() => scrollToSection('contact')}
                            className="h-12 rounded-lg bg-primary px-7 text-primary-foreground shadow-lg shadow-foreground/15 hover:bg-primary/90"
                        >
                            Start a project <ArrowRight className="ml-1 size-4" />
                        </MagneticButton>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => scrollToSection('services')}
                            className="h-12 rounded-lg border-input bg-card/60 px-7 backdrop-blur-sm transition-all hover:border-input hover:bg-card"
                        >
                            Explore our work
                        </Button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.95 }}
                        className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-foreground/70"
                    >
                        {['Senior-led', 'AI accelerated', 'Production ready'].map((item) => (
                            <span key={item} className="inline-flex items-center gap-1.5">
                                <span className="grid size-4 place-items-center rounded-full bg-logo-primary/10 text-logo-primary">
                                    <Check className="size-2.5" strokeWidth={3} />
                                </span>
                                {item}
                            </span>
                        ))}
                    </motion.div>

                    <motion.button
                        type="button"
                        onClick={() => scrollToSection('services')}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.1 }}
                        aria-label="Scroll to services"
                        className="group mt-12 hidden items-center gap-3 text-left md:inline-flex lg:mt-16"
                    >
                        <span className="relative block h-10 w-px overflow-hidden bg-muted-foreground/40">
                            <span className="absolute inset-x-0 top-0 h-4 animate-scroll-cue bg-logo-primary motion-reduce:animate-none" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground transition-colors group-hover:text-foreground/80">
                            What we do
                        </span>
                    </motion.button>
                </div>
            </div>
        </section>
    );
}
