'use client';

import * as React from 'react';

const CELL = 58;
/** How many cells light up on their own. */
const LIT_CELLS = 30;

function noise(i: number) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function LitCells() {
    return (
        <>
            {Array.from({ length: LIT_CELLS }, (_, i) => {
                const col = Math.floor(noise(i * 3 + 1) * 34);
                const row = Math.floor(noise(i * 3 + 2) * 19);
                const brand = i % 5 === 0;
                return (
                    <div
                        key={i}
                        className="absolute animate-cell-fade motion-reduce:animate-none"
                        style={{
                            left: col * CELL,
                            top: row * CELL,
                            width: CELL,
                            height: CELL,
                            opacity: 0,
                            backgroundColor: brand
                                ? 'color-mix(in srgb, var(--logo-primary) 20%, transparent)'
                                : 'color-mix(in srgb, var(--foreground) 11%, transparent)',
                            animationDuration: `${(5 + noise(i * 3 + 3) * 5).toFixed(2)}s`,
                            animationDelay: `${(noise(i * 7 + 5) * 9).toFixed(2)}s`,
                        }}
                    />
                );
            })}
        </>
    );
}
function PointerCell() {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const el = ref.current;
        const host = el?.parentElement;
        if (!el || !host) return;

        let frame = 0;
        let latest: { x: number; y: number } | null = null;

        const apply = () => {
            frame = 0;
            if (!latest) return;
            const rect = host.getBoundingClientRect();
            const x = latest.x - rect.left;
            const y = latest.y - rect.top;
            // Outside the hero: fade out rather than parking at the edge.
            if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
                el.style.opacity = '0';
                return;
            }
            el.style.opacity = '1';
            el.style.transform =
                `translate3d(${Math.floor(x / CELL) * CELL}px, ${Math.floor(y / CELL) * CELL}px, 0)`;
        };

        const onMove = (event: PointerEvent) => {
            latest = { x: event.clientX, y: event.clientY };
            if (!frame) frame = requestAnimationFrame(apply);
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
            window.removeEventListener('pointermove', onMove);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: CELL,
                height: CELL,
                opacity: 0,
                backgroundColor: 'color-mix(in srgb, var(--logo-primary) 9%, transparent)',
                boxShadow:
                    'inset 0 0 0 1px color-mix(in srgb, var(--logo-primary) 20%, transparent),' +
                    ' 0 0 22px 3px color-mix(in srgb, var(--logo-primary) 9%, transparent)',
                transition: 'transform 130ms ease-out, opacity 260ms ease-out',
                willChange: 'transform',
            }}
        />
    );
}

export function HeroBackdrop() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(180deg,' +
                        ' var(--background) 0%,' +
                        ' color-mix(in srgb, var(--secondary) 62%, var(--background)) 50%,' +
                        ' color-mix(in srgb, var(--border) 70%, var(--background)) 100%)',
                }}
            />

            {}
            <div
                className="absolute inset-0"
                style={{
                    maskImage:
                        'radial-gradient(98% 86% at 73% 46%, var(--scrim) 0%, color-mix(in srgb, var(--scrim) 55%, transparent) 42%, transparent 78%)',
                    WebkitMaskImage:
                        'radial-gradient(98% 86% at 73% 46%, var(--scrim) 0%, color-mix(in srgb, var(--scrim) 55%, transparent) 42%, transparent 78%)',
                }}
            >
                <LitCells />
                <PointerCell />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px),' +
                            ' linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px)',
                        backgroundSize: `${CELL}px ${CELL}px`,
                    }}
                />
            </div>

            {}
            <div
                className="absolute -left-[10%] top-[-15%] h-[85%] w-[65%]"
                style={{
                    background:
                        'radial-gradient(closest-side,' +
                        ' color-mix(in srgb, var(--foreground) 7%, transparent),' +
                        ' transparent 74%)',
                }}
            />

            {}
            <div
                className="absolute left-[46%] top-[2%] h-[96%] w-[68%] animate-drift motion-reduce:animate-none"
                style={{
                    background:
                        'radial-gradient(closest-side,' +
                        ' color-mix(in srgb, var(--logo-primary) 19%, transparent) 0%,' +
                        ' color-mix(in srgb, var(--logo-primary) 7%, transparent) 48%,' +
                        ' transparent 76%)',
                    willChange: 'transform',
                }}
            />

            {}
            <div
                className="absolute inset-x-0 bottom-0 h-40"
                style={{
                    background: 'linear-gradient(to top, var(--background), transparent)',
                }}
            />
        </div>
    );
}

export default HeroBackdrop;
