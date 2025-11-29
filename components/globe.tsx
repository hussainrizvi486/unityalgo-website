'use client';

import { cn } from '@/utils';
import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';

export const Globe = ({ className }: { className?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let phi = 0;

        if (!canvasRef.current) return;

        const globe = createGlobe(canvasRef.current, {
            devicePixelRatio: 2,
            width: 600 * 2,
            height: 600 * 2,
            phi: 0,
            theta: 0,
            dark: 0,
            diffuse: 1.2,
            mapSamples: 16000,
            mapBrightness: 6,
            baseColor: [1, 1, 1], // White base
            markerColor: [0.48, 0.06, 0.06], // Deep Red (#7B0F0F converted to RGB 0-1)
            glowColor: [0.8, 0.8, 0.8],
            markers: [
                // Example coordinates (Lat, Long)
                { location: [37.7595, -122.4367], size: 0.03 }, // San Francisco
                { location: [40.7128, -74.006], size: 0.03 }, // New York
                { location: [51.5074, -0.1278], size: 0.03 }, // London
                { location: [24.8607, 67.0011], size: 0.05 }, // Karachi (Your Location)
                { location: [35.6762, 139.6503], size: 0.03 }, // Tokyo
            ],
            onRender: (state) => {
                // Called on every animation frame.
                // `state` will be an empty object, return updated params.
                state.phi = phi;
                phi += 0.005; // Speed of rotation
            },
        });

        return () => {
            globe.destroy();
        };
    }, []);

    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <canvas
                ref={canvasRef}
                style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1 }}
                className="w-full h-full opacity-90 transition-opacity hover:opacity-100"
            />
        </div>
    );
}