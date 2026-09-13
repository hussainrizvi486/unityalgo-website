'use client';

import * as React from 'react';

/**
 * The hero's background.
 *
 * Back to front: a vertical wash off pure white, a blueprint grid, cells that
 * light up on it, the cell under the pointer, a cool counter-light on the left,
 * a crimson bloom under the 3D stack, and a fade back to the page colour at the
 * bottom edge.
 *
 * Every value is derived from a globals.css token via `color-mix` rather than
 * hard-coded, so the hero tracks the palette instead of drifting from it.
 *
 * Nothing here paints per frame. The bloom animates transform only, the grid
 * cells animate opacity only, and the pointer highlight is moved by transform —
 * so all three stay on the compositor. This layer is sharing the page with a
 * WebGL canvas, and a background that repaints would take frames from it.
 */

const CELL = 58;
/** How many cells light up on their own. */
const LIT_CELLS = 30;

/**
 * Deterministic stand-in for Math.random().
 *
 * The cells have to land in the same place on the server and on the client, or
 * React reports a hydration mismatch — and calling Math.random() during render
 * would produce exactly that.
 */
function noise(i: number) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Grid cells that fade up and back down, after Magic UI's Animated Grid Pattern
 * (MIT) by way of 21st.dev.
 *
 * Theirs animates SVG rects through Motion, repositioning each one when its
 * cycle repeats. This is the same effect done with composited divs on CSS
 * keyframes: no JS runs per frame, and no React state changes, which matters
 * more than usual next to a live WebGL scene. In exchange the cells keep their
 * places; with thirty of them on staggered, mismatched durations, the pattern
 * does not visibly repeat anyway.
 */
function LitCells() {
    return (
        <>
            {Array.from({ length: LIT_CELLS }, (_, i) => {
                const col = Math.floor(noise(i * 3 + 1) * 34);
                const row = Math.floor(noise(i * 3 + 2) * 19);
                // Every fifth cell in brand crimson, so the grid carries a
                // little of the colour the object does.
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
                            // backgroundColor, not the `background` shorthand:
                            // React serializes the shorthand to longhands on
                            // the server and sets it as a shorthand on the
                            // client, which hydrates as a mismatch.
                            backgroundColor: brand
                                ? 'color-mix(in srgb, var(--color-brand) 20%, transparent)'
                                : 'color-mix(in srgb, var(--color-ink-900) 11%, transparent)',
                            // Rounded: the browser truncates a style attribute
                            // to six significant digits when it parses it, so a
                            // full-precision float on the server never matches
                            // the value React sets on the client.
                            animationDuration: `${(5 + noise(i * 3 + 3) * 5).toFixed(2)}s`,
                            animationDelay: `${(noise(i * 7 + 5) * 9).toFixed(2)}s`,
                        }}
                    />
                );
            })}
        </>
    );
}
/**
 * The grid cell under the pointer, lit and outlined.
 *
 * One element that moves, rather than a hover target per cell: the grid covers
 * several hundred cells at desktop sizes, and giving each its own box and
 * `:hover` would mean that many elements to lay out and hit-test. It also means
 * the backdrop still needs no pointer events, so it can never come between the
 * reader and the headline they are trying to select — and the highlight tracks
 * the cursor even while it is over the copy.
 *
 * Position is written straight to the node. Routing pointermove through React
 * state would re-render the whole backdrop on every mouse movement, and the
 * thirty animated cells with it.
 */
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

        // Coalesced to one write per frame: pointermove fires far more often
        // than the display refreshes.
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
                backgroundColor: 'color-mix(in srgb, var(--color-brand) 9%, transparent)',
                boxShadow:
                    'inset 0 0 0 1px color-mix(in srgb, var(--color-brand) 20%, transparent),' +
                    ' 0 0 22px 3px color-mix(in srgb, var(--color-brand) 9%, transparent)',
                transition: 'transform 130ms ease-out, opacity 260ms ease-out',
                willChange: 'transform',
            }}
        />
    );
}

export function HeroBackdrop() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {/* Pure white reads as unfinished at this scale; the wash gives the
                section a top and a bottom. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(180deg,' +
                        ' var(--color-background) 0%,' +
                        ' color-mix(in srgb, var(--color-ink-100) 62%, var(--color-background)) 50%,' +
                        ' color-mix(in srgb, var(--color-ink-200) 70%, var(--color-background)) 100%)',
                }}
            />

            {/* Engineering grid, the cells that light up on it, and the one
                under the pointer. All three share a mask, so the pattern is
                densest behind the object and thins toward the headline — a grid
                at full strength under display type competes with it. */}
            <div
                className="absolute inset-0"
                style={{
                    maskImage:
                        'radial-gradient(98% 86% at 73% 46%, #000 0%, rgba(0,0,0,0.55) 42%, transparent 78%)',
                    WebkitMaskImage:
                        'radial-gradient(98% 86% at 73% 46%, #000 0%, rgba(0,0,0,0.55) 42%, transparent 78%)',
                }}
            >
                <LitCells />
                <PointerCell />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, color-mix(in srgb, var(--color-ink-900) 8%, transparent) 1px, transparent 1px),' +
                            ' linear-gradient(to bottom, color-mix(in srgb, var(--color-ink-900) 8%, transparent) 1px, transparent 1px)',
                        backgroundSize: `${CELL}px ${CELL}px`,
                    }}
                />
            </div>

            {/* Cool counter-light behind the copy, opposing the warm bloom on
                the right. Kept very low so it never tints the type. */}
            <div
                className="absolute -left-[10%] top-[-15%] h-[85%] w-[65%]"
                style={{
                    background:
                        'radial-gradient(closest-side,' +
                        ' color-mix(in srgb, var(--color-ink-900) 7%, transparent),' +
                        ' transparent 74%)',
                }}
            />

            {/* Crimson bloom under the stack. The scene's accents are this
                colour, so the object sits in its own light rather than floating
                on white. */}
            <div
                className="absolute left-[46%] top-[2%] h-[96%] w-[68%] animate-drift motion-reduce:animate-none"
                style={{
                    background:
                        'radial-gradient(closest-side,' +
                        ' color-mix(in srgb, var(--color-brand) 19%, transparent) 0%,' +
                        ' color-mix(in srgb, var(--color-brand) 7%, transparent) 48%,' +
                        ' transparent 76%)',
                    willChange: 'transform',
                }}
            />

            {/* Hand back to the page colour so the hero does not end on a seam. */}
            <div
                className="absolute inset-x-0 bottom-0 h-40"
                style={{
                    background: 'linear-gradient(to top, var(--color-background), transparent)',
                }}
            />
        </div>
    );
}

export default HeroBackdrop;
