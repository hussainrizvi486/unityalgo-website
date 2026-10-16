'use client';

import { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';
import { cn } from '@/utils';
import { tokenCss } from '@/lib/css-token';

// The wave lines use the primary token at low alpha — decorative only.
const WAVE_ALPHA = 0.3;
const WAVE_COUNT = 18;

// The operational systems a business already runs — shown orbiting the core
// because today they circle each other without meeting.
const ORBIT_NODES = ['ERP', 'CRM', 'Inventory', 'Payments'] as const;

export function OrbitalSphereBackground({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const noise3D = createNoise3D();

        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = 0;
        let height = 0;
        function resize() {
            if (!container || !ctx) return;
            const dpr = Math.min(window.devicePixelRatio, 2);
            width = container.clientWidth;
            height = container.clientHeight;
            if (width === 0 || height === 0) return;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        let isVisible = true;
        const intersectionObserver = new IntersectionObserver(
            ([entry]) => { isVisible = entry.isIntersecting; },
            { threshold: 0 }
        );
        intersectionObserver.observe(container);

        const waveColor = tokenCss('--primary', WAVE_ALPHA, container);
        let t = 0;
        function drawWaves() {
            if (!ctx) return;
            t += 0.0006;
            const baseline = height * 0.72;
            for (let i = 0; i < WAVE_COUNT; i++) {
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = waveColor;
                ctx.globalAlpha = 0.5 - (i / WAVE_COUNT) * 0.35;
                for (let x = 0; x < width; x += 6) {
                    const y = noise3D(x / 500, 0.15 * i, t) * (height * 0.06) - i * 3;
                    ctx.lineTo(x, y + baseline);
                }
                ctx.stroke();
                ctx.closePath();
            }
        }

        function frame() {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);
            drawWaves();
        }

        let frameId = 0;
        function loop() {
            frameId = requestAnimationFrame(loop);
            if (isVisible) frame();
        }
        if (prefersReducedMotion) {
            frame();
        } else {
            loop();
        }

        return () => {
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            container.removeChild(canvas);
        };
    }, []);

    return (
        <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden', className)}>
            {/* Desktop only. At phone width every horizontal band is occupied by
                copy, so the sphere had nowhere to sit without washing out the
                text behind it; the wave canvas carries the mobile hero instead. */}
            <div className="absolute top-1/2 right-[8%] hidden h-130 w-130 -translate-y-1/2 md:block">
                {/* ambient glow */}
                <div className="orbital-glow absolute inset-[-22%] rounded-full blur-3xl" />

                {/* Outer orbit: the systems a business runs on, circling but not
                    connected — the visual half of the problem stated below the
                    headline. Counter-rotated labels stay upright as they travel. */}
                <div className="absolute inset-[-26%] hidden rounded-full border border-primary/15 md:block">
                    {ORBIT_NODES.map((node, i) => (
                        <div
                            key={node}
                            className="absolute inset-0 motion-safe:animate-[spin_var(--orbit-duration)_linear_infinite]"
                            style={{
                                ['--orbit-duration' as string]: `${46 + i * 7}s`,
                                animationDelay: `${-i * (46 / ORBIT_NODES.length)}s`,
                            }}
                        >
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <span
                                    className="block motion-safe:animate-[spin_var(--orbit-duration)_linear_infinite_reverse] rounded-full border border-primary/20 bg-card/85 px-2.5 py-1 text-micro font-semibold tracking-wide text-primary shadow-sm backdrop-blur-sm"
                                    style={{
                                        ['--orbit-duration' as string]: `${46 + i * 7}s`,
                                        animationDelay: `${-i * (46 / ORBIT_NODES.length)}s`,
                                    }}
                                >
                                    {node}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>

                {/* inner orbit ring + travelling dots */}
                <div className="absolute inset-[-12%] rounded-full border border-primary/20">
                    <div className="absolute inset-0 motion-safe:animate-[spin_38s_linear_infinite]">
                        <span className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    </div>
                    <div
                        className="absolute inset-0 motion-safe:animate-[spin_55s_linear_infinite]"
                        style={{ animationDelay: '-22s' }}
                    >
                        <span className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/80" />
                    </div>
                </div>

                {/* sphere body */}
                <div
                    className="orbital-sphere absolute inset-0 overflow-hidden rounded-full"
                >
                    {/* Meridians and latitudes, so the shape reads as a globe
                        rather than a flat disc. Masked to fade at the limb. */}
                    <div className="orbital-grid absolute inset-0 opacity-20">
                        {[18, 38, 58, 78].map((inset) => (
                            <span
                                key={`m-${inset}`}
                                className="absolute inset-y-0 rounded-[50%] border-x border-background"
                                style={{ left: `${inset / 2}%`, right: `${inset / 2}%` }}
                            />
                        ))}
                        {[22, 40, 58, 76].map((top) => (
                            <span
                                key={`l-${top}`}
                                className="absolute inset-x-0 border-t border-background"
                                style={{ top: `${top}%` }}
                            />
                        ))}
                    </div>

                    {/* specular highlight */}
                    <div className="orbital-highlight absolute inset-0" />
                </div>
            </div>
        </div>
    );
}
