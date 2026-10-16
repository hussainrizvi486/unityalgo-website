'use client';

import { mixRgb, rgbHex, tokenRgb } from '@/lib/css-token';
import * as React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, ContactShadows, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion';
import { detectWebGL } from '@/lib/webgl';
import {
    useStackKit, Panel, Discs, Keys, Graph, Gear, GlassCore, Voxels, Dial, Trace,
    Fan, Heatsink, Ports, Leds, ChipArray, ProgressPanel,
    BrainCore, Cloud, RackUnit, ServerBox, Appliance, ChartPane, BoardFurniture,
    type StackKit,
} from '@/components/website/hero-stack-parts';
import { cn } from '@/utils';

/**
 * "The Stack" — the hero scene.
 *
 * A software system drawn the way engineers picture one: five boards, each
 * populated with the things that actually live at that level. Data and storage
 * at the base, orchestration above it, application code, the interface, and the
 * AI core under glass on top. The boards stay pulled apart into an exploded
 * view — how you draw a system when you are explaining it — and the assembly
 * turns on the spot to follow the pointer.
 *
 * The boards assemble themselves bottom-up on first paint, and steel risers run
 * between them carrying packets upward, so the five layers read as one system
 * rather than five separate objects. Individual components keep their own
 * motion — fans turn, progress bars fill, status lights chase — which is what
 * makes the thing look like it is running rather than posed.
 *
 * Every piece is parametric rather than a downloaded model, which keeps the
 * scene at a few KB of geometry code instead of a multi-megabyte GLB on a page
 * that is already image-heavy. Geometry and materials are built once in
 * `useStackKit` and shared by every mesh.
 *
 * Porcelain, graphite, glass and a little steel, with the brand crimson
 * reserved for the parts that are meant to look powered: status lights, the
 * packets climbing the risers, the core under the glass.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const SLAB_H = 0.14;
// Clearance between one board's deck and the underside of the next. Fixed: the
// stack used to collapse toward the pointer, which read as the whole object
// shrinking rather than as an assembly closing. It has to clear the tallest
// prop — the glass core stands ~0.3 above its board — with room to spare.
const BOARD_GAP = 0.78;
// How far the pointer turns the assembly, in radians. The stack stays put and
// spins in place: moving it across the hero competes with the copy, and at this
// viewing angle a turntable shows off the populated decks far better than a
// slide does. Kept narrow enough that the swing never reaches square-on, where
// the boards lose their three-quarter read and flatten out.
const SPIN_Y = 0.42;

/**
 * Board plan sizes, tapering upward so the closed stack reads as one form.
 *
 * The taper is steep on purpose: at this camera pitch a board of the same size
 * as the one below it would cover most of that board's deck, and the deck is
 * where all the detail lives.
 */
// `glass` belongs to the base sheet and nothing else: a stack of translucent
// boards has no silhouette, and every deck below shows through the one above.
const BOARDS = [
    { w: 3.20, d: 2.46, dark: false, glass: true },
    { w: 2.78, d: 2.12, dark: true, glass: false },
    { w: 2.38, d: 1.82, dark: false, glass: false },
    { w: 2.00, d: 1.54, dark: true, glass: false },
    { w: 1.80, d: 1.40, dark: false, glass: false },
];

/**
 * Pointer position relative to the hero, in -1..1.
 *
 * Tracked on `window` rather than through R3F's `state.pointer`, which only
 * updates from events landing on the canvas. The hero renders this layer with
 * `pointer-events-none` so it never intercepts clicks on the headline or CTAs —
 * which also meant the canvas saw no pointer events at all and the interaction
 * was silently dead. Listening on the window keeps the layer click-through and
 * still lets the stack respond while the cursor is over the copy.
 */
function usePointer(host: React.RefObject<HTMLElement | null>, enabled: boolean) {
    const pointer = React.useRef({ x: 0, y: 0 });
    React.useEffect(() => {
        if (!enabled) return;
        const onMove = (event: PointerEvent) => {
            const el = host.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            pointer.current.x = ((event.clientX - r.left) / r.width) * 2 - 1;
            pointer.current.y = -(((event.clientY - r.top) / r.height) * 2 - 1);
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [host, enabled]);
    return pointer;
}

/**
 * Where the inter-board risers stand, one pair per gap.
 *
 * Corners of the *upper* board's footprint, so a riser lands on solid deck at
 * both ends. Alternating diagonals per gap keeps them from forming one straight
 * column up the side of the stack.
 */
const RISER_SLOTS = BOARDS.slice(1).map((board, gap) => {
    const x = board.w / 2 - 0.2;
    const z = board.d / 2 - 0.2;
    return gap % 2 === 0
        ? [[-x, -z], [x, z]] as const
        : [[x, -z], [-x, z]] as const;
});

/**
 * Contents of each board, bottom to top.
 *
 * Laid out to each board's full footprint rather than clustered at its centre.
 * The board above hides a band across the middle of the one below it, so the
 * centre is the one place a component is guaranteed not to be seen; the busiest
 * rows sit toward the front edge, where every deck stays visible at any spread.
 */
function BoardContents({ index, kit, reduced }: { index: number; kit: StackKit; reduced: boolean }) {
    switch (index) {
        // 0 — the platform itself: the AI core under glass, the cloud, the
        // servers and the database it runs on.
        //
        // A single row, all of it in the front third of the deck. Board 1
        // covers the middle and back of this board at every spread, and a prop
        // standing here hides a band roughly 1.4x its own height behind it — so
        // one row is genuinely all that can be seen, and a composition centred
        // the way a standalone render would be is one nobody ever sees.
        case 0: return (
            <>
                <Discs kit={kit} position={[-1.28, 0.07, 0.9]} count={3} cap />
                <ServerBox kit={kit} position={[-0.78, 0.07, 0.92]} rotation={0.14} />
                <BrainCore kit={kit} position={[-0.05, 0.07, 0.9]} reduced={reduced} />
                <RackUnit kit={kit} position={[0.64, 0.07, 0.92]} rotation={0.2} bays={2} />
                <Cloud kit={kit} position={[1.12, 0.07, 0.88]} />
                {/* Behind the row: read as depth past the front pieces rather
                    than as objects in their own right. */}
                <ChartPane kit={kit} position={[0.3, 0.07, 0.34]} rotation={-0.18} reduced={reduced} />
                <Appliance kit={kit} position={[-1.16, 0.07, 0.36]} rotation={0.16} />
                <Trace kit={kit} from={[-1.28, 0.9]} to={[-0.78, 0.92]} pulse reduced={reduced} delay={0.0} />
                <Trace kit={kit} from={[-0.78, 0.92]} to={[-0.05, 0.9]} />
                <Trace kit={kit} from={[-0.05, 0.9]} to={[0.64, 0.92]} pulse reduced={reduced} delay={0.34} />
                <Trace kit={kit} from={[0.64, 0.92]} to={[1.12, 0.88]} />
            </>
        );
        // 1 — orchestration & automation
        case 1: return (
            <>
                <Graph kit={kit} position={[-0.42, 0.07, 0.5]} reduced={reduced} />
                <ChipArray kit={kit} position={[0.44, 0.07, 0.56]} cols={3} rows={2} />
                <Leds kit={kit} position={[0.94, 0.07, 0.7]} count={4} reduced={reduced} />
                <ProgressPanel kit={kit} position={[-0.7, 0.07, -0.06]} size={[0.66, 0.46]} reduced={reduced} />
                <Gear kit={kit} position={[0.14, 0.07, -0.08]} reduced={reduced} />
                <Fan kit={kit} position={[0.82, 0.07, -0.06]} reduced={reduced} speed={2.8} />
                <Keys kit={kit} position={[-0.84, 0.07, -0.66]} cols={3} rows={2} />
                <Panel kit={kit} position={[0.1, 0.07, -0.68]} size={[0.8, 0.46]} lines={3} />
                <Ports kit={kit} position={[0.92, 0.07, -0.7]} count={2} />
                <Trace kit={kit} from={[-0.42, 0.5]} to={[0.44, 0.56]} pulse reduced={reduced} delay={0.68} />
                <Trace kit={kit} from={[-0.42, 0.5]} to={[-0.7, -0.06]} />
                <Trace kit={kit} from={[-0.7, -0.06]} to={[0.14, -0.08]} pulse reduced={reduced} delay={0.02} />
                <Trace kit={kit} from={[0.14, -0.08]} to={[0.1, -0.68]} />
            </>
        );
        // 2 — application code
        case 2: return (
            <>
                <Panel kit={kit} position={[-0.42, 0.07, 0.44]} size={[1.0, 0.5]} lines={4} />
                <Keys kit={kit} position={[0.5, 0.07, 0.44]} cols={3} rows={2} />
                <Voxels kit={kit} position={[-0.76, 0.07, -0.06]} />
                <ProgressPanel kit={kit} position={[-0.04, 0.07, -0.04]} size={[0.72, 0.46]} reduced={reduced} />
                <ChipArray kit={kit} position={[0.68, 0.07, -0.06]} cols={2} rows={2} />
                <Leds kit={kit} position={[-0.84, 0.07, -0.56]} count={3} reduced={reduced} />
                <Panel kit={kit} position={[0.06, 0.07, -0.58]} size={[0.8, 0.4]} lines={3} />
                <Dial kit={kit} position={[0.76, 0.07, -0.56]} />
                <Trace kit={kit} from={[-0.42, 0.44]} to={[-0.04, -0.04]} pulse reduced={reduced} delay={0.36} />
                <Trace kit={kit} from={[-0.04, -0.04]} to={[0.68, -0.06]} />
                <Trace kit={kit} from={[-0.76, -0.06]} to={[-0.04, -0.04]} pulse reduced={reduced} delay={0.7} />
            </>
        );
        // 3 — interface
        case 3: return (
            <>
                <Panel kit={kit} position={[-0.36, 0.07, 0.38]} size={[0.88, 0.44]} lines={4} />
                <Dial kit={kit} position={[0.46, 0.07, 0.38]} />
                <Leds kit={kit} position={[0.66, 0.07, 0.5]} count={3} reduced={reduced} />
                <Panel kit={kit} position={[0.28, 0.07, -0.06]} size={[0.8, 0.46]} lines={3} />
                <Keys kit={kit} position={[-0.62, 0.07, -0.04]} cols={2} rows={2} />
                <ChipArray kit={kit} position={[-0.5, 0.07, -0.5]} cols={2} rows={2} />
                <Ports kit={kit} position={[0.42, 0.07, -0.52]} count={3} />
                <Trace kit={kit} from={[-0.36, 0.38]} to={[0.28, -0.06]} />
                <Trace kit={kit} from={[-0.62, -0.04]} to={[-0.5, -0.5]} pulse reduced={reduced} delay={0.04} />
            </>
        );
        // 4 — the AI core, under glass
        default: return (
            <>
                <GlassCore kit={kit} position={[-0.06, 0.07, 0.06]} reduced={reduced} />
                <Leds kit={kit} position={[-0.24, 0.07, 0.48]} count={4} reduced={reduced} />
                <Dial kit={kit} position={[0.56, 0.07, 0.4]} />
                <Panel kit={kit} position={[0.58, 0.07, -0.24]} size={[0.5, 0.4]} lines={3} />
                <Keys kit={kit} position={[-0.62, 0.07, -0.34]} cols={2} rows={2} />
                <Heatsink kit={kit} position={[-0.02, 0.07, -0.46]} fins={6} />
                <Trace kit={kit} from={[-0.62, -0.34]} to={[-0.06, 0.06]} />
                <Trace kit={kit} from={[-0.06, 0.06]} to={[0.58, -0.24]} pulse reduced={reduced} delay={0.38} />
            </>
        );
    }
}

/**
 * The one unmistakable through-line in the model.
 *
 * The individual deck traces show activity within a layer; this rail shows the
 * layers working as a system. It sits just outside the smallest boards so the
 * crimson packets remain visible instead of disappearing through components.
 */
function DataSpine({ kit, reduced }: { kit: StackKit; reduced: boolean }) {
    const pulses = React.useRef<THREE.Mesh[]>([]);
    const bottom = -1.05;
    const step = SLAB_H + BOARD_GAP;
    const top = bottom + step * (BOARDS.length - 1);
    const height = top - bottom;

    useFrame((state) => {
        if (reduced) return;
        pulses.current.forEach((pulse, i) => {
            if (!pulse) return;
            const phase = (state.clock.elapsedTime * 0.24 + i * 0.5) % 1;
            pulse.position.y = bottom + phase * height;
            const swell = Math.sin(phase * Math.PI);
            pulse.scale.setScalar(Math.max(0.001, 0.075 * swell));
        });
    });

    return (
        <group position={[-1.06, 0, -0.74]}>
            <mesh
                geometry={kit.wire}
                material={kit.graphite}
                position={[0, bottom + height / 2, 0]}
                scale={[0.027, height, 0.027]}
            />
            {BOARDS.map((_, i) => (
                <group key={i} position={[0, bottom + i * step, 0]}>
                    <mesh geometry={kit.cyl} material={kit.steel} scale={[0.105, 0.035, 0.105]} />
                    <mesh geometry={kit.sphere} material={kit.brandLit} scale={0.052} />
                </group>
            ))}
            {[0, 1].map((i) => (
                <mesh
                    key={i}
                    ref={(el) => { if (el) pulses.current[i] = el; }}
                    geometry={kit.sphere}
                    material={kit.brandLit}
                    position={[0, bottom + (i * height) / 2, 0]}
                    scale={reduced ? 0.055 : 0.001}
                />
            ))}
        </group>
    );
}

function Stack({ reduced, pointer }: {
    reduced: boolean;
    pointer: React.RefObject<{ x: number; y: number }>;
}) {
    const root = React.useRef<THREE.Group>(null);
    const boards = React.useRef<THREE.Group[]>([]);
    const packets = React.useRef<THREE.Mesh[]>([]);
    const decks = React.useRef<THREE.Group[]>([]);
    const kit = useStackKit();

    // 0 -> 1 once, on mount: the stack assembles itself rather than appearing.
    const intro = React.useRef(reduced ? 1 : 0);
    // Smoothed turntable angle, so the object eases toward the cursor rather
    // than tracking it rigidly.
    const spin = React.useRef(0);

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        intro.current = Math.min(1, intro.current + dt / 1.5);

        // The pointer turns the assembly on its vertical axis.
        const targetSpin = reduced ? 0 : pointer.current.x * SPIN_Y;
        spin.current += (targetSpin - spin.current) * Math.min(1, dt * 2.4);

        for (let i = 0; i < BOARDS.length; i++) {
            const g = boards.current[i];
            if (!g) continue;
            // Staggered so the boards arrive bottom-up, the way the thing would
            // actually be built. Cubic ease-out: fast in, settling at the end.
            const p = clamp01((intro.current - i * 0.11) / 0.6);
            const enter = 1 - Math.pow(1 - p, 3);

            // Higher boards travel further, so the stack fans from its base
            // like a real exploded view instead of sliding uniformly.
            const rest = i * (SLAB_H + BOARD_GAP) - 1.05;
            // A slow per-board bob, phase-shifted, so the layers never look
            // welded to one another.
            const bob = reduced ? 0 : Math.sin(t * 0.9 + i * 0.8) * 0.014;
            g.position.y = rest + bob - (1 - enter) * 1.4;
            g.rotation.y = (i % 2 === 0 ? 0.07 : -0.07) + (1 - enter) * 0.5;
            g.scale.setScalar(0.6 + 0.4 * enter);

            // Contents land a beat after the board they sit on, so the stack
            // assembles rather than appearing fully built.
            const deck = decks.current[i];
            if (deck) {
                const dp = clamp01((intro.current - i * 0.11 - 0.16) / 0.5);
                const settle = 1 - Math.pow(1 - dp, 3);
                deck.scale.setScalar(0.001 + 0.999 * settle);
                deck.position.y = (1 - settle) * 0.22;
            }
        }

        for (let n = 0; n < packets.current.length; n++) {
            const packet = packets.current[n];
            if (!packet) continue;
            if (reduced) { packet.scale.setScalar(0.001); continue; }
            // Offset per riser so packets are never in lockstep.
            const phase = (t * 0.5 + n * 0.23) % 1;
            packet.position.y = phase * BOARD_GAP;
            // Swell in and out at the ends: packets arrive rather than pop.
            packet.scale.setScalar(Math.max(0.001, 0.055 * Math.sin(phase * Math.PI)));
        }

        if (root.current && !reduced) {
            root.current.rotation.y = 0.6 + Math.sin(t * 0.16) * 0.08 + spin.current;
            root.current.rotation.x = 0.62 + Math.sin(t * 0.22) * 0.02 + pointer.current.y * 0.04;
        }
    });

    return (
        <group ref={root} rotation={[0.62, 0.6, 0]}>
            <DataSpine kit={kit} reduced={reduced} />
            {BOARDS.map((board, i) => (
                <group key={i} ref={(el) => { if (el) boards.current[i] = el; }}>
                    <mesh
                        geometry={kit.plate}
                        material={
                            board.glass ? kit.glassSlab
                                : board.dark ? kit.graphite : kit.porcelain
                        }
                        // A glass sheet is thinner than a machined board.
                        scale={[board.w, board.glass ? SLAB_H * 0.68 : SLAB_H, board.d]}
                        // A shadow map has no notion of opacity, so a glass
                        // caster throws the same solid black shape a porcelain
                        // one does. The base sheet is grounded by the contact
                        // shadow underneath it instead.
                        castShadow={!board.glass}
                        receiveShadow
                    />
                    <BoardFurniture
                        kit={kit}
                        width={board.w}
                        depth={board.d}
                        slab={board.glass ? SLAB_H * 0.68 : SLAB_H}
                        dark={board.dark}
                        glass={board.glass}
                    />
                    <group ref={(el) => { if (el) decks.current[i] = el; }}>
                        <BoardContents index={i} kit={kit} reduced={reduced} />
                    </group>
                    {i < BOARDS.length - 1 && RISER_SLOTS[i].map(([x, z], k) => {
                        const n = i * 2 + k;
                        return (
                            <group key={k} position={[x, SLAB_H / 2, z]}>
                                <mesh
                                    geometry={kit.wire}
                                    material={kit.steel}
                                    position={[0, BOARD_GAP / 2, 0]}
                                    scale={[0.018, BOARD_GAP, 0.018]}
                                />
                                <mesh
                                    ref={(el) => { if (el) packets.current[n] = el; }}
                                    geometry={kit.sphere}
                                    material={kit.brandLit}
                                    scale={0.055}
                                />
                            </group>
                        );
                    })}
                </group>
            ))}
        </group>
    );
}

/** Roughly how wide the stack is, in world units, at scale 1. */
const OBJECT_W = 4.3;
/** How much of the hero, in CSS px, the copy column and its gutter claim. */
const COPY_COLUMN = 700;

/**
 * Sizes and places the stack from the space actually left beside the copy.
 *
 * A fixed offset only ever framed one viewport: the object's on-screen size
 * tracks viewport *height* (the camera's field of view is vertical) while the
 * copy column's width is near-constant, so at 1024–1280 a stack framed for
 * 1440 sat straight on top of the paragraph. This measures the free strip and
 * fits the object to it.
 */
function Rig({ children }: { children: React.ReactNode }) {
    const { size, viewport } = useThree();
    const { scale, x } = React.useMemo(() => {
        const free = Math.max(0, size.width - COPY_COLUMN);
        const naturalPx = OBJECT_W * viewport.factor;
        const fitted = Math.max(0.55, Math.min(1, (free - 40) / naturalPx));
        // Centre of the free strip, in px, converted back to world units.
        const centrePx = size.width - free / 2;
        return { scale: fitted, x: ((centrePx / size.width) * 2 - 1) * (viewport.width / 2) };
    }, [size.width, viewport.factor, viewport.width]);

    return <group position={[x, 0, 0]} scale={scale}>{children}</group>;
}

/**
 * A soft light that rises through the stack on a loop.
 *
 * One moving light does what no amount of extra geometry can: it picks out a
 * different layer every few seconds, so the eye is walked up through the
 * assembly instead of settling on the top board. Kept neutral rather than
 * crimson — a tinted light would wash the porcelain boards pink and pull the
 * brand colour off the parts that are meant to carry it.
 */
/** Studio light colours: the page background, shaded toward the muted tone by `shade`. */
const lightColor = (shade: number) => rgbHex(mixRgb(tokenRgb('--background'), tokenRgb('--muted'), shade));

function SweepLight({ reduced }: { reduced: boolean }) {
    const light = React.useRef<THREE.PointLight>(null);
    useFrame((state) => {
        if (!light.current) return;
        const t = (state.clock.elapsedTime * 0.13) % 1;
        light.current.position.y = -1.3 + t * 4.4;
        // Fades in and out at the ends so it never pops at the turnaround.
        light.current.intensity = 1.9 * Math.sin(t * Math.PI);
    });
    if (reduced) return null;
    return <pointLight ref={light} color={lightColor(0)} distance={4.6} decay={2} position={[0.4, -1.3, 0.9]} />;
}

function Scene({ reduced, pointer }: {
    reduced: boolean;
    pointer: React.RefObject<{ x: number; y: number }>;
}) {
    return (
        <>
            {/* Studio rig, inline. drei's `preset` environments fetch an HDR
                from a CDN at runtime — a network dependency this page should
                not carry, and one that fails behind a strict CSP. */}
            <Environment resolution={256}>
                <Lightformer intensity={3.2} position={[2, 5, 3]} scale={[7, 3, 1]} color={lightColor(0)} />
                <Lightformer intensity={1.3} position={[-5, 1, 2]} scale={[3, 7, 1]} color={lightColor(0.15)} />
                <Lightformer intensity={0.9} position={[4, -2, 1]} scale={[4, 4, 1]} color={lightColor(0.3)} />
                <Lightformer intensity={0.6} position={[0, -4, -3]} scale={[8, 3, 1]} color={lightColor(0)} />
            </Environment>

            <directionalLight
                position={[4.5, 7, 4]}
                intensity={2.1}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-near={1}
                shadow-camera-far={24}
                shadow-camera-left={-6}
                shadow-camera-right={6}
                shadow-camera-top={6}
                shadow-camera-bottom={-6}
                shadow-bias={-0.0005}
            />
            <ambientLight intensity={0.55} />
            <pointLight
                color={rgbHex(tokenRgb('--logo-primary'))}
                intensity={1.6}
                distance={5.4}
                decay={2}
                position={[2.4, 0.4, 2.8]}
            />

            <SweepLight reduced={reduced} />
            <Stack reduced={reduced} pointer={pointer} />

            <ContactShadows
                position={[0, -1.5, 0]}
                opacity={0.4}
                scale={10}
                blur={2.5}
                far={5}
                resolution={256}
                color={rgbHex(tokenRgb('--foreground'))}
                frames={100}
            />
        </>
    );
}

/**
 * Renders nothing if the scene cannot start.
 *
 * three.js throws `Error creating WebGL context` outright when WebGL is
 * unavailable — a locked-down browser, a blocklisted driver, a VM without
 * acceleration. The hero's headline, copy and CTAs do not depend on the scene,
 * so the right outcome is to drop the visual silently rather than surface an
 * uncaught error. The plain-three version of this file guarded the renderer in
 * a try/catch; moving to React Three Fiber lost that, and this restores it.
 */
class CanvasBoundary extends React.Component<
    { children: React.ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export function ConnectedSystemsCanvas({ className }: { className?: string }) {
    const reduced = usePrefersReducedMotion();
    const host = React.useRef<HTMLDivElement>(null);
    const pointer = usePointer(host, !reduced);
    // The hero already gates on this before importing the module, so reaching
    // here unsupported should be impossible — kept because the component is
    // exported and a future caller may not know to check.
    const [supported] = React.useState(detectWebGL);

    return (
        <div ref={host} className={cn('absolute inset-0', className)} aria-hidden="true">
            {supported && (
                <CanvasBoundary>
                    <Canvas
                        camera={{ position: [0, 1.1, 12], fov: 34 }}
                        dpr={[1, 2]}
                        performance={{ min: 0.5 }}
                        shadows
                        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
                        frameloop={reduced ? 'demand' : 'always'}
                        className="bg-transparent"
                    >
                        <Rig>
                            <Scene reduced={reduced} pointer={pointer} />
                        </Rig>
                        <AdaptiveDpr pixelated />
                    </Canvas>
                </CanvasBoundary>
            )}
        </div>
    );
}

export default ConnectedSystemsCanvas;
