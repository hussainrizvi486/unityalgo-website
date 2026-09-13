'use client';

import { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';
import { cn } from '@/utils';

// brand-soft (#BC292E) at low alpha — decorative use only, per the palette.
const WAVE_COLOR = 'rgba(188, 41, 46, 0.30)';
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

        let t = 0;
        function drawWaves() {
            if (!ctx) return;
            t += 0.0006;
            const baseline = height * 0.72;
            for (let i = 0; i < WAVE_COUNT; i++) {
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = WAVE_COLOR;
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
            <div className="absolute top-1/2 right-[8%] hidden h-[520px] w-[520px] -translate-y-1/2 md:block">
                {/* ambient glow */}
                <div className="absolute inset-[-22%] rounded-full bg-[radial-gradient(circle,rgba(188,41,46,0.22),transparent_70%)] blur-3xl" />

                {/* Outer orbit: the systems a business runs on, circling but not
                    connected — the visual half of the problem stated below the
                    headline. Counter-rotated labels stay upright as they travel. */}
                <div className="absolute inset-[-26%] hidden rounded-full border border-brand/15 md:block">
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
                                    className="block motion-safe:animate-[spin_var(--orbit-duration)_linear_infinite_reverse] rounded-full border border-brand/20 bg-white/85 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-brand shadow-sm backdrop-blur-sm"
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
                <div className="absolute inset-[-12%] rounded-full border border-brand/20">
                    <div className="absolute inset-0 motion-safe:animate-[spin_38s_linear_infinite]">
                        <span className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
                    </div>
                    <div
                        className="absolute inset-0 motion-safe:animate-[spin_55s_linear_infinite]"
                        style={{ animationDelay: '-22s' }}
                    >
                        <span className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-soft" />
                    </div>
                </div>

                {/* sphere body */}
                <div
                    className="absolute inset-0 overflow-hidden rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle at 32% 26%, #FFF7ED 0%, #F8E9EA 9%, #E39EA2 21%, #CE4E53 38%, #BC292E 54%, #8C181B 75%, #591013 100%)',
                        boxShadow: '0 40px 100px -20px rgb(21 21 21 / 0.28)',
                    }}
                >
                    {/* Meridians and latitudes, so the shape reads as a globe
                        rather than a flat disc. Masked to fade at the limb. */}
                    <div
                        className="absolute inset-0 opacity-[0.18]"
                        style={{
                            maskImage: 'radial-gradient(circle at 40% 34%, #000 30%, transparent 78%)',
                            WebkitMaskImage: 'radial-gradient(circle at 40% 34%, #000 30%, transparent 78%)',
                        }}
                    >
                        {[18, 38, 58, 78].map((inset) => (
                            <span
                                key={`m-${inset}`}
                                className="absolute inset-y-0 rounded-[50%] border-x border-white"
                                style={{ left: `${inset / 2}%`, right: `${inset / 2}%` }}
                            />
                        ))}
                        {[22, 40, 58, 76].map((top) => (
                            <span
                                key={`l-${top}`}
                                className="absolute inset-x-0 border-t border-white"
                                style={{ top: `${top}%` }}
                            />
                        ))}
                    </div>

                    {/* specular highlight */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.38),transparent_38%)]" />
                </div>
            </div>
        </div>
    );
}
