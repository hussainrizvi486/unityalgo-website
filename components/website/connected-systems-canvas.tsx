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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const SLAB_H = 0.14;
const BOARD_GAP = 0.78;
const SPIN_Y = 0.42;

const BOARDS = [
    { w: 3.20, d: 2.46, dark: false, glass: true },
    { w: 2.78, d: 2.12, dark: true, glass: false },
    { w: 2.38, d: 1.82, dark: false, glass: false },
    { w: 2.00, d: 1.54, dark: true, glass: false },
    { w: 1.80, d: 1.40, dark: false, glass: false },
];

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

const RISER_SLOTS = BOARDS.slice(1).map((board, gap) => {
    const x = board.w / 2 - 0.2;
    const z = board.d / 2 - 0.2;
    return gap % 2 === 0
        ? [[-x, -z], [x, z]] as const
        : [[x, -z], [-x, z]] as const;
});

function BoardContents({ index, kit, reduced }: { index: number; kit: StackKit; reduced: boolean }) {
    switch (index) {
        case 0: return (
            <>
                <Discs kit={kit} position={[-1.28, 0.07, 0.9]} count={3} cap />
                <ServerBox kit={kit} position={[-0.78, 0.07, 0.92]} rotation={0.14} />
                <BrainCore kit={kit} position={[-0.05, 0.07, 0.9]} reduced={reduced} />
                <RackUnit kit={kit} position={[0.64, 0.07, 0.92]} rotation={0.2} bays={2} />
                <Cloud kit={kit} position={[1.12, 0.07, 0.88]} />
                {}
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
            const p = clamp01((intro.current - i * 0.11) / 0.6);
            const enter = 1 - Math.pow(1 - p, 3);

            const rest = i * (SLAB_H + BOARD_GAP) - 1.05;
            const bob = reduced ? 0 : Math.sin(t * 0.9 + i * 0.8) * 0.014;
            g.position.y = rest + bob - (1 - enter) * 1.4;
            g.rotation.y = (i % 2 === 0 ? 0.07 : -0.07) + (1 - enter) * 0.5;
            g.scale.setScalar(0.6 + 0.4 * enter);

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
            {}
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
