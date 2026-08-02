'use client';

import { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';
import { cn } from '@/utils';

const SPEED = { slow: 0.0008, fast: 0.002 } as const;

function readThemeColor(cssVar: string, fallback: string) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    return value || fallback;
}

export function WavyBackground({
    className,
    waveCount = 9,
    waveWidth = 1.5,
    waveOpacity = 0.3,
    blur = 12,
    speed = 'slow',
}: {
    className?: string;
    waveCount?: number;
    waveWidth?: number;
    waveOpacity?: number;
    blur?: number;
    speed?: keyof typeof SPEED;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const noise3D = createNoise3D();

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const waveColors = Array.from(
            { length: waveCount },
            (_, i) => readThemeColor(`--color-brand-${[300, 400, 500, 600, 700][i % 5]}`, '#8C181B')
        );

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
            ctx.filter = `blur(${blur}px)`;
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
            t += SPEED[speed];
            for (let i = 0; i < waveCount; i++) {
                ctx.beginPath();
                ctx.lineWidth = waveWidth;
                ctx.strokeStyle = waveColors[i];
                ctx.globalAlpha = waveOpacity;
                for (let x = 0; x < width; x += 5) {
                    const y = noise3D(x / 420, 0.18 * i, t) * (height * 0.1);
                    ctx.lineTo(x, y + height * 0.5);
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
    }, [waveCount, waveWidth, waveOpacity, blur, speed]);

    return <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden', className)} />;
}
