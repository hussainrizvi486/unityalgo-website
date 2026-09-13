'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Button } from '@/components/ui/button';
import { HeroBackdrop } from '@/components/website/hero-backdrop';
import { ArrowRight, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMediaQuery } from '@/lib/use-reduced-motion';
import { detectWebGL } from '@/lib/webgl';

// three.js is ~600KB, so it is code-split out of the initial bundle and only
// fetched once the hero mounts. ssr:false because it needs a WebGL context.
/**
 * Loaded only once we know it will be used.
 *
 * next/dynamic defers the chunk, but it still fetches as soon as the component
 * renders — and the scene's own "is this viewport wide enough / does WebGL
 * exist" checks live *inside* it. That meant every phone downloaded ~960KB of
 * three.js to render nothing. The gate is hoisted above the import below, so
 * the chunk is fetched only where the scene actually runs.
 */
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

/**
 * Extruded display type, to match the object beside it.
 *
 * Stacked hard-edged shadows at a fixed offset — an axonometric extrusion, the
 * same projection the 3D scene is drawn in, rather than a perspective one that
 * would read as a different space. Offsets are in `em` so the depth tracks the
 * type size across breakpoints instead of overwhelming the headline on mobile.
 *
 * This is text-shadow rather than WebGL on purpose: the headline is the page's
 * h1, and it has to stay selectable, searchable and readable by a screen
 * reader. Extruded glyph geometry in the canvas would be none of those.
 */
// Many shallow steps rather than a few deep ones: at six steps the staircase
// is visible along diagonal strokes, where each copy lands a whole pixel from
// the last. The step stays small as the depth grows, so deeper means more
// copies, not coarser ones.
// Keep just enough depth to relate the type to the exploded stack. The former
// 0.15em extrusion became a second visual object of its own and made the copy
// column feel heavier than the model.
const EXTRUDE_DEPTH = 0.055;
const EXTRUDE_STEP = 0.0055;
const EXTRUDE_STEPS = Math.round(EXTRUDE_DEPTH / EXTRUDE_STEP);

function extrude(side: string) {
    const layers = Array.from({ length: EXTRUDE_STEPS }, (_, i) => {
        const offset = ((i + 1) * EXTRUDE_STEP).toFixed(4);
        return `${offset}em ${offset}em 0 ${side}`;
    });
    // One soft cast underneath, so the letters sit on the page rather than
    // floating in front of it.
    layers.push('0.08em 0.1em 0.14em rgb(var(--shadow-color) / 0.09)');
    return layers.join(', ');
}

const INK_EXTRUDE = extrude('var(--color-ink-300)');
const BRAND_EXTRUDE = extrude('color-mix(in srgb, var(--color-brand) 38%, white)');

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
    // Below this width there is no room for the scene beside the copy, and
    // without WebGL it cannot start at all. Both are checked here rather than
    // inside the scene so the decision precedes the import.
    const wideEnough = useMediaQuery('(min-width: 1000px)');
    const [webglAvailable] = useState(detectWebGL);

    const showScene = wideEnough && webglAvailable;

    const scrollToSection = (id: string) => {
        // Smooth scrolling is motion too — honouring the preference here as
        // well as in the 3D scene, rather than only where it is obvious.
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    };

    return (
        <section className="relative flex min-h-[720px] items-center overflow-hidden bg-background px-4 pb-16 pt-28 sm:px-6 lg:min-h-screen lg:pb-20 lg:pt-32">
            {/* One background, not three. The node field replaced the CSS
                orbital sphere and its wave canvas, which were competing with it
                and with the headline. */}
            <HeroBackdrop />
            {showScene ? <ConnectedSystemsCanvas className="z-0 pointer-events-none" /> : null}
            
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-[0.035] mix-blend-multiply"
                style={{ backgroundImage: `url("${GRAIN_URL}")` }}
            />

            {showScene ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-5 z-[5] hidden w-36 xl:block 2xl:right-10"
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
                            <span className="h-px w-7 bg-brand/45" />
                            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="container relative z-10 mx-auto w-full">
                <div className="max-w-[690px] text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                        className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand/20 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-sm"
                    >
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-40 motion-reduce:animate-none" />
                            <span className="relative inline-flex size-2 rounded-full bg-brand" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-700">
                            AI-native product engineering
                        </span>
                    </motion.div>

                    <h1 className="mb-7 font-display text-[clamp(3rem,5.2vw,4.85rem)] font-extrabold leading-[0.98] tracking-[-0.045em] [word-spacing:0.08em]">
                        {headlineLines.map((line, i) => (
                            // The wrapper clips for the reveal, which would cut
                            // the extrusion off at the baseline; the padding
                            // gives it room and the negative margin keeps the
                            // line spacing where it was.
                            <span key={line.text} className="-mb-[0.13em] block overflow-hidden pb-[0.13em]">
                                <motion.span
                                    initial={{ y: '110%' }}
                                    animate={{ y: '0%' }}
                                    transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                                    className={line.accent ? 'block text-brand' : 'block text-ink-900'}
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
                        className="mb-8 max-w-xl text-balance text-base leading-7 text-ink-600 sm:text-lg sm:leading-8"
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
                            className="h-12 rounded-lg bg-ink-900 px-7 text-white shadow-lg shadow-ink-900/15 hover:bg-ink-800"
                        >
                            Start a project <ArrowRight className="ml-1 size-4" />
                        </MagneticButton>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => scrollToSection('services')}
                            className="h-12 rounded-lg border-ink-300 bg-white/60 px-7 backdrop-blur-sm transition-all hover:border-ink-400 hover:bg-white"
                        >
                            Explore our work
                        </Button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.95 }}
                        className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-600"
                    >
                        {['Senior-led', 'AI accelerated', 'Production ready'].map((item) => (
                            <span key={item} className="inline-flex items-center gap-1.5">
                                <span className="grid size-4 place-items-center rounded-full bg-brand-subdued text-brand">
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
                        <span className="relative block h-10 w-px overflow-hidden bg-ink-300">
                            <span className="absolute inset-x-0 top-0 h-4 animate-scroll-cue bg-ink-800 motion-reduce:animate-none" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[.18em] text-ink-400 transition-colors group-hover:text-ink-700">
                            What we do
                        </span>
                    </motion.button>
                </div>
            </div>
        </section>
    );
}
