'use client';

import * as React from 'react';
import { cn } from '@/utils';

export interface ChartPoint {
    t: string;
    value: number | null;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { top: 8, right: 8, bottom: 20, left: 8 };

function niceCeiling(value: number) {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const unit = value / power;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function timeLabel(iso: string, span: number) {
    const date = new Date(iso);
    return span > 36 * 3600_000
        ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function MetricChart({
    title,
    points,
    format,
    limit,
    limitLabel = 'Limit',
    tone = 'primary',
    className,
}: {
    title: string;
    points: ChartPoint[];
    format: (value: number) => string;
    limit?: number | null;
    limitLabel?: string;
    tone?: 'primary' | 'success' | 'warning';
    className?: string;
}) {
    const [hover, setHover] = React.useState<number | null>(null);
    const id = React.useId();
    const known = points.filter((p) => p.value !== null) as { t: string; value: number }[];
    const times = points.map((p) => new Date(p.t).getTime());
    const start = Math.min(...times);
    const end = Math.max(...times);
    const span = Math.max(end - start, 1);
    const top = niceCeiling(Math.max(...known.map((p) => p.value), limit ?? 0, 1) * 1.1);
    const x = (time: number) => PAD.left + ((time - start) / span) * (WIDTH - PAD.left - PAD.right);
    const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);
    const floor = HEIGHT - PAD.bottom;

    // Consecutive readings form a run; a missing reading ends it.
    const runs: { x: number; y: number }[][] = [];
    points.forEach((point, index) => {
        if (point.value === null) {
            runs.push([]);
            return;
        }
        if (!runs.length) runs.push([]);
        runs[runs.length - 1].push({ x: x(times[index]), y: y(point.value) });
    });
    const drawn = runs.filter((run) => run.length > 0);
    const latest = known.at(-1);
    const shown = hover !== null ? points[hover] : null;

    function onMove(event: React.PointerEvent<SVGSVGElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const at = ((event.clientX - box.left) / box.width) * WIDTH;
        let best = 0;
        let distance = Infinity;
        times.forEach((time, index) => {
            const d = Math.abs(x(time) - at);
            if (d < distance && points[index].value !== null) { distance = d; best = index; }
        });
        setHover(best);
    }

    return (
        <figure className={cn('rounded-xl border bg-card p-card', className)}>
            <figcaption className="flex items-baseline justify-between gap-gap">
                <span className="portal-text-body font-semibold text-foreground">{title}</span>
                <span className="portal-text-body tabular-nums text-muted-foreground">
                    {shown?.value != null ? (
                        <>{format(shown.value)} <span className="portal-text-caption">· {timeLabel(shown.t, span)}</span></>
                    ) : latest ? format(latest.value) : '—'}
                </span>
            </figcaption>
            {known.length === 0 ? (
                <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-muted/50 portal-text-caption text-muted-foreground">No readings yet</div>
            ) : (
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="mt-3 h-40 w-full touch-none overflow-visible"
                    role="img"
                    aria-label={`${title} over time`}
                    onPointerMove={onMove}
                    onPointerLeave={() => setHover(null)}
                >
                    <defs>
                        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={`var(--${tone})`} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={`var(--${tone})`} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map((fraction) => (
                        <line key={fraction} x1={PAD.left} x2={WIDTH - PAD.right} y1={y(top * fraction)} y2={y(top * fraction)} stroke="var(--border)" strokeWidth="1" />
                    ))}
                    <text x={PAD.left} y={y(top) + 11} fontSize="11" fill="var(--muted-foreground)">{format(top)}</text>
                    {limit != null && limit > 0 && (
                        <g>
                            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(limit)} y2={y(limit)} stroke="var(--destructive)" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={WIDTH - PAD.right} y={y(limit) - 4} fontSize="11" textAnchor="end" fill="var(--destructive)">{limitLabel} {format(limit)}</text>
                        </g>
                    )}
                    {drawn.map((run, index) => {
                        const line = run.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                        const area = `${line} L${run.at(-1)!.x.toFixed(1)},${floor} L${run[0].x.toFixed(1)},${floor} Z`;
                        return (
                            <g key={index}>
                                {run.length > 1 && <path d={area} fill={`url(#${id}-fill)`} />}
                                {run.length > 1
                                    ? <path d={line} fill="none" stroke={`var(--${tone})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                    : <circle cx={run[0].x} cy={run[0].y} r="3" fill={`var(--${tone})`} />}
                            </g>
                        );
                    })}
                    <text x={PAD.left} y={HEIGHT - 4} fontSize="11" fill="var(--muted-foreground)">{timeLabel(points[0].t, span)}</text>
                    <text x={WIDTH - PAD.right} y={HEIGHT - 4} fontSize="11" textAnchor="end" fill="var(--muted-foreground)">{timeLabel(points.at(-1)!.t, span)}</text>
                    {hover !== null && shown?.value != null && (
                        <g>
                            <line x1={x(times[hover])} x2={x(times[hover])} y1={PAD.top} y2={floor} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="2 3" />
                            <circle cx={x(times[hover])} cy={y(shown.value)} r="4" fill="var(--card)" stroke={`var(--${tone})`} strokeWidth="2" />
                        </g>
                    )}
                </svg>
            )}
        </figure>
    );
}

export function AvailabilityStrip({ points, className }: { points: { t: string; up: number }[]; className?: string }) {
    return (
        <figure className={cn('rounded-xl border bg-card p-card', className)}>
            <figcaption className="portal-text-body font-semibold text-foreground">Availability</figcaption>
            {points.length === 0 ? (
                <div className="mt-3 flex h-10 items-center justify-center rounded-lg bg-muted/50 portal-text-caption text-muted-foreground">No readings yet</div>
            ) : (
                <div className="mt-3 flex h-10 items-stretch gap-px" role="img" aria-label="Availability over time">
                    {points.map((point) => (
                        <span
                            key={point.t}
                            title={`${new Date(point.t).toLocaleString()} — ${Math.round(point.up * 100)}% of checks answered`}
                            className={cn('min-w-px flex-1 rounded-sm', point.up >= 1 ? 'bg-success' : point.up > 0 ? 'bg-warning' : 'bg-destructive')}
                        />
                    ))}
                </div>
            )}
        </figure>
    );
}
