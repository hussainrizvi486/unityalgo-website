'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';

/**
 * The prop vocabulary for the hero stack.
 *
 * Each layer of the stack is a populated board rather than a bare slab, so
 * these are the pieces that sit on it: panels with dark screen faces, a glass
 * block over a chip, database discs, node graphs, keycaps, gears. They are
 * parametric rather than modelled, which keeps the whole scene at a few KB of
 * code instead of a multi-megabyte GLB.
 *
 * Geometry and materials are created once by `useStackKit` and handed to every
 * prop, so 100+ meshes share a handful of GPU buffers.
 */

export interface StackKit {
    box: THREE.BufferGeometry;
    plate: THREE.BufferGeometry;
    cyl: THREE.BufferGeometry;
    sphere: THREE.BufferGeometry;
    wire: THREE.BufferGeometry;
    porcelain: THREE.Material;
    graphite: THREE.Material;
    screen: THREE.Material;
    glass: THREE.Material;
    glassSlab: THREE.Material;
    steel: THREE.Material;
    brand: THREE.Material;
    brandLit: THREE.Material;
}

/**
 * A small tile of value noise, used as the frosted sheet's roughness map.
 *
 * Cheap enough to build at runtime — 64x64, generated once — and it saves
 * shipping a texture file for what is a handful of bytes of randomness.
 */
function makeFrostTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
        // Biased high: the sheet should be mostly rough, with a few polished
        // patches, rather than an even 50/50 mottle.
        const v = 150 + Math.random() * 105;
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
        image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    return texture;
}

export function useStackKit(): StackKit {
    const kit = React.useMemo<StackKit>(() => {
    const frost = makeFrostTexture();
    return ({
        // A unit rounded box, scaled per prop — one buffer for every block.
        box: new RoundedBoxGeometry(1, 1, 1, 3, 0.16),
        // Flatter radius for cards, so thin panels do not read as pillows.
        plate: new RoundedBoxGeometry(1, 1, 1, 3, 0.07),
        cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
        sphere: new THREE.SphereGeometry(0.5, 20, 14),
        wire: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
        porcelain: new THREE.MeshPhysicalMaterial({
            color: '#F7F7F7', roughness: 0.3, metalness: 0.02,
            clearcoat: 0.85, clearcoatRoughness: 0.22,
        }),
        graphite: new THREE.MeshPhysicalMaterial({
            color: '#232323', roughness: 0.33, metalness: 0.2,
            clearcoat: 0.8, clearcoatRoughness: 0.25,
        }),
        // Near-black and glossy, so panels read as displays rather than slabs.
        screen: new THREE.MeshPhysicalMaterial({
            color: '#111111', roughness: 0.12, metalness: 0.3,
            clearcoat: 1, clearcoatRoughness: 0.06,
        }),
        // Deliberately not `transmission`: real refraction makes three.js
        // render the scene to a separate buffer for every transmissive mesh,
        // every frame, which cost ~500ms/frame here. At this size a plain
        // translucent surface with a strong clearcoat is visually equivalent.
        glass: new THREE.MeshPhysicalMaterial({
            color: '#EDF1F5', roughness: 0.08, metalness: 0.05,
            clearcoat: 1, clearcoatRoughness: 0.04,
            transparent: true, opacity: 0.32,
        }),
        // The base sheet the whole stack sits on: frosted, not clear.
        //
        // Frosted glass is a diffuse surface, so the look comes from high
        // roughness plus a milky opacity — not from transparency. `transmission`
        // would give real refractive blur, but it costs an extra full-scene
        // render every frame, and behind this sheet there is only the page and
        // the contact shadow: blurring a flat backdrop is indistinguishable
        // from simply being milky.
        //
        // The frost is broken up by a noise roughnessMap, so the sheet catches
        // the studio lights unevenly the way real etched glass does rather than
        // as one flat sheen. depthWrite stays off so the contact shadow reads
        // faintly through it — the one cue that there is anything behind it at
        // all. Depth *testing* still applies, so props standing on the sheet
        // are unaffected.
        glassSlab: new THREE.MeshPhysicalMaterial({
            color: '#C4CFD8', roughness: 0.55, metalness: 0,
            roughnessMap: frost,
            clearcoat: 1, clearcoatRoughness: 0.3,
            ior: 1.45, envMapIntensity: 1.2,
            transparent: true, opacity: 0.68, depthWrite: false,
        }),
        steel: new THREE.MeshPhysicalMaterial({
            color: '#9E9E9E', roughness: 0.25, metalness: 0.6, clearcoat: 0.6,
        }),
        // Brand crimson, in two weights.
        //
        // `brand` is the platform's --color-brand on solid faces: the core's
        // chip, a keycap, a dial's index mark. `brandLit` is --color-brand-soft
        // carrying emissive, for the things that are meant to look *powered* —
        // status lights, data packets, the pulse running a graph edge. There is
        // no bloom pass in this scene, so emissive is what makes a 5cm sphere
        // read as lit rather than merely painted.
        brand: new THREE.MeshPhysicalMaterial({
            color: '#8C181B', roughness: 0.28, metalness: 0.08,
            clearcoat: 1, clearcoatRoughness: 0.12,
            emissive: new THREE.Color('#8C181B'), emissiveIntensity: 0.25,
        }),
        brandLit: new THREE.MeshPhysicalMaterial({
            color: '#9C1B20', roughness: 0.18, metalness: 0,
            clearcoat: 1, clearcoatRoughness: 0.06,
            // Emitting the deep brand crimson rather than the lighter soft tint:
            // a hot emissive washes the hue toward a generic bright red, which
            // stops reading as the platform's colour at all.
            emissive: new THREE.Color('#8C181B'), emissiveIntensity: 0.7,
        }),
    });
    }, []);

    React.useEffect(() => () => {
        // Disposing a material does not dispose its textures, so the frost map
        // is released explicitly.
        (kit.glassSlab as THREE.MeshPhysicalMaterial).roughnessMap?.dispose();
        Object.values(kit).forEach((v) => (v as { dispose?: () => void }).dispose?.());
    }, [kit]);

    return kit;
}

type Vec3 = [number, number, number];
interface PropProps { kit: StackKit; position: Vec3; rotation?: number }

/** Thin ridged lines on a screen face, standing in for text and data rows. */
function ScreenLines({ kit, width, depth, rows = 4 }: {
    kit: StackKit; width: number; depth: number; rows?: number;
}) {
    return (
        <>
            {Array.from({ length: rows }, (_, i) => {
                // Rows vary in length so the block reads as text, not a grid.
                const w = width * (0.72 - (i % 3) * 0.18);
                return (
                    <mesh
                        key={i}
                        geometry={kit.plate}
                        material={i === 0 ? kit.brandLit : kit.porcelain}
                        position={[-(width - w) / 2 + width * 0.06, 0.012, -depth * 0.28 + i * (depth * 0.16)]}
                        scale={[w, 0.012, depth * 0.05]}
                    />
                );
            })}
        </>
    );
}

/** A card with a dark display face — the most common piece on a board. */
export function Panel({ kit, position, rotation = 0, size, lines = 4, dark = true }: PropProps & {
    size: [number, number]; lines?: number; dark?: boolean;
}) {
    const [w, d] = size;
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.plate} material={dark ? kit.screen : kit.porcelain}
                  scale={[w, 0.055, d]} />
            <group position={[0, 0.028, 0]}>
                <ScreenLines kit={kit} width={w} depth={d} rows={lines} />
            </group>
        </group>
    );
}

/** Stacked discs — the universal shorthand for a database. */
export function Discs({ kit, position, count = 3, cap = false }: PropProps & {
    count?: number; cap?: boolean;
}) {
    return (
        <group position={position}>
            {Array.from({ length: count }, (_, i) => (
                <mesh key={i} geometry={kit.cyl}
                      material={i % 2 ? kit.porcelain : kit.graphite}
                      position={[0, i * 0.085, 0]} scale={[0.26, 0.075, 0.26]}
                      />
            ))}
            {cap && (
                <mesh geometry={kit.cyl} material={kit.porcelain}
                      position={[0, count * 0.085, 0]} scale={[0.27, 0.09, 0.27]} />
            )}
        </group>
    );
}

/** Keycap grid — a control surface. */
export function Keys({ kit, position, cols = 2, rows = 2 }: PropProps & { cols?: number; rows?: number }) {
    return (
        <group position={position}>
            {Array.from({ length: cols * rows }, (_, i) => (
                <mesh key={i} geometry={kit.box}
                      material={i === 0 ? kit.brand : i % 3 === 0 ? kit.graphite : kit.porcelain}
                      position={[(i % cols) * 0.19, 0.045, Math.floor(i / cols) * 0.19]}
                      scale={[0.15, 0.075, 0.15]} />
            ))}
        </group>
    );
}

/** A node graph with a pulse running the edges — work moving through a service. */
export function Graph({ kit, position, reduced }: PropProps & { reduced: boolean }) {
    const pulse = React.useRef<THREE.Mesh>(null);
    const nodes: Vec3[] = React.useMemo(() => [
        [-0.34, 0.05, -0.14], [-0.02, 0.05, 0.12], [0.3, 0.05, -0.1], [0.06, 0.05, -0.3],
    ], []);
    const edges: Array<[number, number]> = [[0, 1], [1, 2], [1, 3]];

    useFrame((state) => {
        if (!pulse.current || reduced) return;
        // Travel the first edge on a loop, easing at both ends.
        const t = (state.clock.elapsedTime * 0.5) % 1;
        const a = nodes[0]; const b = nodes[1];
        pulse.current.position.set(
            a[0] + (b[0] - a[0]) * t, 0.06, a[2] + (b[2] - a[2]) * t,
        );
        const s = 0.05 + Math.sin(t * Math.PI) * 0.03;
        pulse.current.scale.setScalar(s);
    });

    return (
        <group position={position}>
            {nodes.map((n, i) => (
                <mesh key={i} geometry={kit.sphere} material={i === 0 ? kit.brand : kit.porcelain}
                      position={n} scale={0.1} />
            ))}
            {edges.map(([i, j], k) => {
                const a = new THREE.Vector3(...nodes[i]);
                const b = new THREE.Vector3(...nodes[j]);
                const mid = a.clone().add(b).multiplyScalar(0.5);
                const len = a.distanceTo(b);
                const angle = Math.atan2(b.z - a.z, b.x - a.x);
                return (
                    <mesh key={k} geometry={kit.wire} material={kit.steel}
                          position={[mid.x, 0.045, mid.z]}
                          rotation={[0, 0, Math.PI / 2]}
                          scale={[0.012, len, 0.012]}
                          // rotate about Y after the Z tilt lays it flat
                          onUpdate={(m) => { m.rotation.set(0, -angle, Math.PI / 2); }} />
                );
            })}
            <mesh ref={pulse} geometry={kit.sphere} material={kit.brandLit} scale={0.05} />
        </group>
    );
}

/** A turning gear — the automation on the services layer. */
export function Gear({ kit, position, reduced }: PropProps & { reduced: boolean }) {
    const ref = React.useRef<THREE.Group>(null);
    useFrame((_, dt) => { if (ref.current && !reduced) ref.current.rotation.y += dt * 0.9; });
    return (
        <group position={position}>
            <mesh geometry={kit.box} material={kit.porcelain} scale={[0.26, 0.13, 0.26]} />
            <group ref={ref} position={[0, 0.1, 0]}>
                <mesh geometry={kit.cyl} material={kit.graphite} scale={[0.13, 0.06, 0.13]} />
                {Array.from({ length: 6 }, (_, i) => {
                    const a = (i / 6) * Math.PI * 2;
                    return (
                        <mesh key={i} geometry={kit.box} material={kit.graphite}
                              position={[Math.cos(a) * 0.115, 0, Math.sin(a) * 0.115]}
                              rotation={[0, -a, 0]} scale={[0.055, 0.05, 0.035]} />
                    );
                })}
            </group>
        </group>
    );
}

/** A glass block over a chip — the AI core, and the one refractive moment. */
export function GlassCore({ kit, position, reduced }: PropProps & { reduced: boolean }) {
    const chip = React.useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (!chip.current || reduced) return;
        // A slow breath rather than a spin, so it reads as "running".
        chip.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.012;
    });
    return (
        <group position={position}>
            <mesh geometry={kit.plate} material={kit.porcelain} scale={[0.62, 0.05, 0.62]} />
            <mesh ref={chip} geometry={kit.plate} material={kit.brand}
                  position={[0, 0.1, 0]} scale={[0.34, 0.11, 0.34]} />
            {/* Studs on the chip, like a package's contacts. */}
            {Array.from({ length: 4 }, (_, i) => (
                <mesh key={i} geometry={kit.sphere} material={kit.brandLit}
                      position={[(i % 2 ? 0.07 : -0.07), 0.17, (i < 2 ? 0.07 : -0.07)]} scale={0.045} />
            ))}
            <mesh geometry={kit.box} material={kit.glass}
                  position={[0, 0.15, 0]} scale={[0.56, 0.3, 0.56]} />
        </group>
    );
}

/** A cluster of small cubes — a build artefact, or a container set. */
export function Voxels({ kit, position }: PropProps) {
    const cells: Vec3[] = [
        [0, 0, 0], [0.1, 0, 0], [0, 0, 0.1], [0.1, 0.1, 0.1], [0, 0.1, 0], [0.1, 0, 0.1],
    ];
    return (
        <group position={position}>
            {cells.map((c, i) => (
                <mesh key={i} geometry={kit.box} material={i % 2 ? kit.graphite : kit.porcelain}
                      position={[c[0], c[1] + 0.05, c[2]]} scale={0.095} />
            ))}
        </group>
    );
}

/** A dial — a control, and a bit of turned metal for material variety. */
export function Dial({ kit, position }: PropProps) {
    return (
        <group position={position}>
            <mesh geometry={kit.cyl} material={kit.graphite} scale={[0.19, 0.05, 0.19]} />
            <mesh geometry={kit.cyl} material={kit.steel} position={[0, 0.05, 0]} scale={[0.12, 0.05, 0.12]} />
            <mesh geometry={kit.box} material={kit.brandLit} position={[0, 0.08, 0.05]} scale={[0.02, 0.02, 0.07]} />
        </group>
    );
}

/**
 * A packet running one trace.
 *
 * Split out so `useFrame` only exists for traces that actually carry one — a
 * board has a dozen traces and most are there as wiring, not as movement.
 */
function TracePulse({ kit, from, to, delay }: {
    kit: StackKit; from: THREE.Vector2; to: THREE.Vector2; delay: number;
}) {
    const dot = React.useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (!dot.current) return;
        const t = (state.clock.elapsedTime * 0.55 + delay) % 1;
        dot.current.position.set(
            from.x + (to.x - from.x) * t,
            0.044,
            from.y + (to.y - from.y) * t,
        );
        // Swell in and out so packets arrive rather than blink on at the end.
        dot.current.scale.setScalar(Math.max(0.001, 0.042 * Math.sin(t * Math.PI)));
    });
    return <mesh ref={dot} geometry={kit.sphere} material={kit.brandLit} scale={0.001} />;
}

/**
 * A thin surface trace between two points on a board.
 *
 * `pulse` sends a packet down it. Boards read as populated without it and as
 * *running* with it, which is the difference between a component diagram and a
 * machine — but every trace carrying one at once looks like a fairground, so it
 * is opt-in per trace.
 */
export function Trace({ kit, from, to, pulse = false, reduced = false, delay = 0 }: {
    kit: StackKit; from: [number, number]; to: [number, number];
    pulse?: boolean; reduced?: boolean; delay?: number;
}) {
    const a = new THREE.Vector2(...from);
    const b = new THREE.Vector2(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    return (
        <>
            <mesh geometry={kit.plate} material={kit.steel}
                  position={[mid.x, 0.032, mid.y]} rotation={[0, -angle, 0]}
                  scale={[len, 0.008, 0.012]} />
            {pulse && !reduced ? <TracePulse kit={kit} from={a} to={b} delay={delay} /> : null}
        </>
    );
}

/**
 * The furniture every board carries: a silkscreen border and corner standoffs.
 *
 * Cheap detail that does a lot of work — a bare slab reads as a placeholder,
 * while an inset border and four machined posts read as a manufactured part.
 * Sized from the board so it tracks the taper without per-board constants.
 */
export function BoardFurniture({ kit, width, depth, slab, dark, glass = false }: {
    kit: StackKit; width: number; depth: number; slab: number; dark: boolean; glass?: boolean;
}) {
    const inset = 0.13;
    const w = width - inset * 2;
    const d = depth - inset * 2;
    const top = slab / 2;
    // Graphite gives the contrast a porcelain deck needs, but on the frosted
    // sheet it reads as a drawn outline rather than printed silkscreen.
    const line = dark || glass ? kit.steel : kit.graphite;
    return (
        <group position={[0, top, 0]}>
            {/* Silkscreen border, four thin rails just proud of the deck. */}
            <mesh geometry={kit.plate} material={line} position={[0, 0.002, -d / 2]} scale={[w, 0.006, 0.014]} />
            <mesh geometry={kit.plate} material={line} position={[0, 0.002, d / 2]} scale={[w, 0.006, 0.014]} />
            <mesh geometry={kit.plate} material={line} position={[-w / 2, 0.002, 0]} scale={[0.014, 0.006, d]} />
            <mesh geometry={kit.plate} material={line} position={[w / 2, 0.002, 0]} scale={[0.014, 0.006, d]} />
            {/* Standoffs, one per corner. */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
                <group key={i} position={[(sx * w) / 2, 0, (sz * d) / 2]}>
                    <mesh geometry={kit.cyl} material={kit.steel} scale={[0.062, 0.05, 0.062]} />
                    <mesh geometry={kit.cyl} material={kit.screen} position={[0, 0.026, 0]} scale={[0.032, 0.012, 0.032]} />
                </group>
            ))}
        </group>
    );
}

/** A spinning cooling fan — the most legible "this is running" cue on a board. */
export function Fan({ kit, position, reduced, speed = 2.4 }: PropProps & { reduced: boolean; speed?: number }) {
    const blades = React.useRef<THREE.Group>(null);
    useFrame((_, dt) => { if (blades.current && !reduced) blades.current.rotation.y += dt * speed; });
    return (
        <group position={position}>
            {/* housing */}
            <mesh geometry={kit.plate} material={kit.graphite} scale={[0.46, 0.05, 0.46]} />
            <mesh geometry={kit.cyl} material={kit.screen} position={[0, 0.03, 0]} scale={[0.36, 0.03, 0.36]} />
            <group ref={blades} position={[0, 0.06, 0]}>
                <mesh geometry={kit.cyl} material={kit.brand} scale={[0.08, 0.035, 0.08]} />
                {Array.from({ length: 5 }, (_, i) => {
                    const a = (i / 5) * Math.PI * 2;
                    return (
                        <mesh
                            key={i}
                            geometry={kit.plate}
                            material={kit.porcelain}
                            position={[Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12]}
                            rotation={[0, -a, 0.42]}
                            scale={[0.17, 0.012, 0.075]}
                        />
                    );
                })}
            </group>
        </group>
    );
}

/** A finned heatsink — pure silhouette detail, no animation needed. */
export function Heatsink({ kit, position, fins = 8 }: PropProps & { fins?: number }) {
    return (
        <group position={position}>
            <mesh geometry={kit.plate} material={kit.graphite} scale={[0.5, 0.04, 0.34]} />
            {Array.from({ length: fins }, (_, i) => (
                <mesh
                    key={i}
                    geometry={kit.plate}
                    material={kit.steel}
                    position={[-0.21 + i * (0.42 / (fins - 1)), 0.09, 0]}
                    scale={[0.022, 0.14, 0.3]}
                />
            ))}
        </group>
    );
}

/** A row of connector slots along a board edge. */
export function Ports({ kit, position, count = 4, rotation = 0 }: PropProps & { count?: number }) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.plate} material={kit.graphite}
                  scale={[count * 0.115 + 0.05, 0.07, 0.16]} />
            {Array.from({ length: count }, (_, i) => (
                <mesh key={i} geometry={kit.plate} material={kit.screen}
                      position={[-(count - 1) * 0.0575 + i * 0.115, 0.04, 0]}
                      scale={[0.08, 0.035, 0.1]} />
            ))}
        </group>
    );
}

/**
 * Status LEDs that pulse in sequence.
 *
 * Scale rather than colour is animated: every light shares one material, so a
 * colour change would affect all of them at once.
 */
export function Leds({ kit, position, count = 4, reduced }: PropProps & { count?: number; reduced: boolean }) {
    const group = React.useRef<THREE.Group>(null);
    useFrame((state) => {
        if (!group.current || reduced) return;
        const t = state.clock.elapsedTime;
        group.current.children.forEach((child, i) => {
            // A travelling wave along the row, so it reads as activity rather
            // than a set of independently blinking dots.
            const phase = Math.sin(t * 2.4 - i * 0.7);
            child.scale.setScalar(0.05 + Math.max(0, phase) * 0.035);
        });
    });
    return (
        <group ref={group} position={position}>
            {Array.from({ length: count }, (_, i) => (
                <mesh key={i} geometry={kit.sphere} material={kit.brandLit}
                      position={[i * 0.1, 0.05, 0]} scale={0.05} />
            ))}
        </group>
    );
}

/** A grid of small dies — a chip package or a container set. */
export function ChipArray({ kit, position, cols = 3, rows = 2 }: PropProps & { cols?: number; rows?: number }) {
    return (
        <group position={position}>
            <mesh geometry={kit.plate} material={kit.screen}
                  scale={[cols * 0.13 + 0.06, 0.04, rows * 0.13 + 0.06]} />
            {Array.from({ length: cols * rows }, (_, i) => (
                <mesh key={i} geometry={kit.plate} material={kit.steel}
                      position={[
                          -(cols - 1) * 0.065 + (i % cols) * 0.13,
                          0.04,
                          -(rows - 1) * 0.065 + Math.floor(i / cols) * 0.13,
                      ]}
                      scale={[0.1, 0.03, 0.1]} />
            ))}
        </group>
    );
}

/** A panel with a bar that fills and resets — a build, or a job running. */
export function ProgressPanel({ kit, position, size, reduced }: PropProps & {
    size: [number, number]; reduced: boolean;
}) {
    const bar = React.useRef<THREE.Mesh>(null);
    const [w, d] = size;
    useFrame((state) => {
        if (!bar.current || reduced) return;
        const t = (state.clock.elapsedTime * 0.35) % 1;
        // Scale from the left edge rather than the centre, so it fills.
        const filled = w * 0.78 * t;
        bar.current.scale.x = Math.max(0.001, filled);
        bar.current.position.x = -w * 0.39 + filled / 2;
    });
    return (
        <group position={position}>
            <mesh geometry={kit.plate} material={kit.screen} scale={[w, 0.055, d]} />
            {/* track */}
            <mesh geometry={kit.plate} material={kit.graphite}
                  position={[0, 0.03, d * 0.18]} scale={[w * 0.78, 0.012, d * 0.14]} />
            {/* fill */}
            <mesh ref={bar} geometry={kit.plate} material={kit.brandLit}
                  position={[0, 0.038, d * 0.18]} scale={[0.001, 0.014, d * 0.13]} />
            <group position={[0, 0.03, -d * 0.16]}>
                <ScreenLines kit={kit} width={w} depth={d * 0.5} rows={2} />
            </group>
        </group>
    );
}

/**
 * The AI core: a die carrying a brain glyph, under a glass canopy.
 *
 * The glyph is a dozen small spheres rather than a modelled brain — at this
 * size the silhouette is all that survives, and a sphere cluster reads as one
 * where a detailed mesh would just read as noise.
 */
export function BrainCore({ kit, position, reduced }: PropProps & { reduced: boolean }) {
    const canopy = React.useRef<THREE.Group>(null);
    // Two lobes of overlapping blobs at varied sizes. An even grid of spheres
    // reads as a keypad; the irregularity is what makes it read as a brain.
    const lobes = React.useMemo<Array<[number, number, number]>>(() => {
        const half: Array<[number, number, number]> = [
            [0.034, -0.072, 0.050], [0.090, -0.050, 0.044], [0.126, -0.006, 0.038],
            [0.040, -0.012, 0.054], [0.094, 0.024, 0.048], [0.034, 0.054, 0.050],
            [0.082, 0.074, 0.040], [0.128, 0.050, 0.034],
        ];
        return half.flatMap(([x, z, r]) => [[x, z, r], [-x, z * 0.92, r * 0.94]] as Array<[number, number, number]>);
    }, []);

    useFrame((state) => {
        if (!canopy.current || reduced) return;
        canopy.current.position.y = 0.17 + Math.sin(state.clock.elapsedTime * 1.1) * 0.014;
    });

    return (
        <group position={position}>
            {/* Pedestal */}
            <mesh geometry={kit.box} material={kit.graphite} scale={[0.7, 0.17, 0.7]} />
            {/* No crimson here on purpose: the canopy is transparent, so a lit
                plate under it does not read as a seam — it reads as a solid red
                block seen through glass. The core stays graphite, porcelain and
                glass, and the crimson lives on the status lights around it. */}
            <group ref={canopy} position={[0, 0.17, 0]}>
                {/* Glass canopy */}
                <mesh geometry={kit.box} material={kit.glass} scale={[0.6, 0.17, 0.6]} />
                {/* The die, sitting proud of the glass */}
                <mesh geometry={kit.plate} material={kit.porcelain}
                      position={[0, 0.1, 0]} scale={[0.46, 0.06, 0.46]} />
                <mesh geometry={kit.plate} material={kit.graphite}
                      position={[0, 0.125, 0]} scale={[0.4, 0.045, 0.4]} />
                {lobes.map(([x, z, r], i) => (
                    <mesh key={i} geometry={kit.sphere} material={kit.porcelain}
                          position={[x, 0.152, z]} scale={[r, r * 0.62, r]} />
                ))}
            </group>
        </group>
    );
}

/** A cloud, from overlapping spheres on a rounded base. */
export function Cloud({ kit, position }: PropProps) {
    const puffs: Array<[number, number, number, number]> = [
        [-0.13, 0.12, 0.02, 0.24],
        [0.03, 0.17, -0.01, 0.29],
        [0.19, 0.11, 0.01, 0.23],
    ];
    return (
        <group position={position}>
            {/* Darker mass behind, pale mass in front — the reference's two-tone
                cloud, done with depth rather than an outline. */}
            {puffs.map((p, i) => (
                <mesh key={`b${i}`} geometry={kit.sphere} material={kit.graphite}
                      position={[p[0] + 0.03, p[1] - 0.01, p[2] - 0.055]} scale={p[3] * 0.94} />
            ))}
            {puffs.map((p, i) => (
                <mesh key={`f${i}`} geometry={kit.sphere} material={kit.porcelain}
                      position={[p[0], p[1], p[2] + 0.03]} scale={p[3]} />
            ))}
            <mesh geometry={kit.box} material={kit.porcelain}
                  position={[0.03, 0.07, 0.0]} scale={[0.44, 0.13, 0.24]} />
        </group>
    );
}

/** A rack unit: dark body, pale cap, indicator lights down the face. */
export function RackUnit({ kit, position, rotation = 0, bays = 2 }: PropProps & { bays?: number }) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.box} material={kit.graphite} scale={[0.36, 0.34, 0.36]} />
            <mesh geometry={kit.box} material={kit.porcelain}
                  position={[0, 0.19, 0]} scale={[0.3, 0.12, 0.3]} />
            {Array.from({ length: bays }, (_, i) => (
                <React.Fragment key={i}>
                    <mesh geometry={kit.plate} material={kit.screen}
                          position={[-0.02, 0.02 - i * 0.11, 0.18]} scale={[0.22, 0.055, 0.02]} />
                    <mesh geometry={kit.sphere} material={kit.brandLit}
                          position={[0.13, 0.02 - i * 0.11, 0.18]} scale={0.032} />
                </React.Fragment>
            ))}
        </group>
    );
}

/** A server with a display face and a status light. */
export function ServerBox({ kit, position, rotation = 0 }: PropProps) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.box} material={kit.graphite} scale={[0.56, 0.26, 0.42]} />
            <mesh geometry={kit.plate} material={kit.screen}
                  position={[0.04, 0.14, 0]} scale={[0.36, 0.03, 0.26]} />
            {Array.from({ length: 3 }, (_, i) => (
                <mesh key={i} geometry={kit.plate} material={kit.screen}
                      position={[-0.16, 0.06 - i * 0.07, 0.215]} scale={[0.14, 0.035, 0.02]} />
            ))}
            <mesh geometry={kit.sphere} material={kit.brandLit}
                  position={[0.18, 0.06, 0.215]} scale={0.034} />
        </group>
    );
}

/** A small pale appliance with one status light. */
export function Appliance({ kit, position, rotation = 0 }: PropProps) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.box} material={kit.graphite} scale={[0.36, 0.09, 0.3]} />
            <mesh geometry={kit.box} material={kit.porcelain}
                  position={[0, 0.11, 0]} scale={[0.34, 0.17, 0.28]} />
            <mesh geometry={kit.sphere} material={kit.brandLit}
                  position={[0.1, 0.11, 0.145]} scale={0.03} />
        </group>
    );
}

/** A standing glass pane with bar-chart columns that rise and settle. */
export function ChartPane({ kit, position, rotation = 0, reduced }: PropProps & { reduced: boolean }) {
    const bars = React.useRef<THREE.Group>(null);
    // Kept short: the pane stands on a deck with another board 0.72 above it,
    // and a taller chart would spear straight through it.
    const heights = React.useMemo(() => [0.12, 0.23, 0.18, 0.3, 0.2], []);
    useFrame((state) => {
        if (!bars.current || reduced) return;
        const t = state.clock.elapsedTime;
        bars.current.children.forEach((bar, i) => {
            const h = heights[i] * (0.82 + Math.sin(t * 0.9 + i * 0.6) * 0.18);
            bar.scale.y = h;
            // Grow from the baseline rather than the centre.
            bar.position.y = h / 2;
        });
    });
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={kit.plate} material={kit.glass}
                  position={[0, 0.24, 0]} scale={[0.78, 0.44, 0.035]} />
            <group ref={bars} position={[0, 0.06, 0.03]}>
                {heights.map((h, i) => (
                    <mesh key={i} geometry={kit.plate} material={i === 3 ? kit.brandLit : kit.steel}
                          position={[-0.27 + i * 0.135, h / 2, 0]} scale={[0.068, h, 0.02]} />
                ))}
            </group>
        </group>
    );
}
