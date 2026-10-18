'use client';

import * as React from 'react';
import type { MetricsRange, SiteMetrics } from '@/lib/controller-client';
import { FilterPills } from '@/components/admin/filter-pills';
import { Notice } from '@/components/ui/notice';
import { AvailabilityStrip, MetricChart } from '@/components/ui/metric-chart';

const RANGES: { value: MetricsRange; label: string }[] = [
    { value: '1h', label: '1 hour' },
    { value: '6h', label: '6 hours' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
];

const REFRESH_MS = 60_000;

const mb = (value: number) => (value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`);
const percent = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)}%`;
const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`);

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
    return (
        <div className="rounded-xl border bg-card p-card">
            <p className="portal-text-caption text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
            {hint && <p className="mt-0.5 portal-text-caption text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function MonitoringPanel({ endpoint, className }: { endpoint: string; className?: string }) {
    const [range, setRange] = React.useState<MetricsRange>('24h');
    const [data, setData] = React.useState<SiteMetrics | null>(null);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        async function load() {
            try {
                if (!document.hidden) {
                    const response = await fetch(`${endpoint}?range=${range}`, { signal: controller.signal, cache: 'no-store' });
                    if (!response.ok) throw new Error();
                    setData(await response.json());
                    setError('');
                }
            } catch (failure) {
                if ((failure as Error).name === 'AbortError') return;
                setError('Monitoring data could not be loaded. Retrying shortly.');
            }
            timer = setTimeout(load, REFRESH_MS);
        }
        void load();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [endpoint, range]);

    const summary = data?.summary;
    const points = data?.points ?? [];
    const series = (pick: (point: SiteMetrics['points'][number]) => number | null) => points.map((point) => ({ t: point.t, value: pick(point) }));
    const waiting = data !== null && summary?.samples === 0;

    return (
        <section className={className}>
            <div className="flex flex-wrap items-center justify-between gap-gap">
                <div>
                    <h2 className="font-semibold">Monitoring</h2>
                    <p className="portal-text-caption text-muted-foreground">
                        Sampled every {data ? Math.round(data.interval_seconds / 60) : 5} minutes while the site is running.
                    </p>
                </div>
                <FilterPills label="Time range" value={range} onChange={setRange} options={RANGES} />
            </div>

            {error && <Notice tone="warning" className="mt-4">{error}</Notice>}
            {!data && !error && <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted/60" aria-label="Loading monitoring data" />}
            {waiting && (
                <Notice tone="info" className="mt-4">
                    {data.running
                        ? 'Collecting the first readings. They appear within a few minutes.'
                        : 'There are no readings for this period. A site is only sampled while it is running.'}
                </Notice>
            )}

            {data && summary && !waiting && (
                <>
                    <div className="mt-4 grid grid-cols-2 gap-gap lg:grid-cols-4">
                        <Stat
                            label="Uptime"
                            value={summary.uptime_percent === null ? '—' : `${summary.uptime_percent}%`}
                            hint={summary.outages ? `${summary.outages} outage${summary.outages === 1 ? '' : 's'}` : 'No outages'}
                            tone={summary.uptime_percent !== null && summary.uptime_percent >= 99.9 ? 'good' : summary.uptime_percent !== null && summary.uptime_percent < 99 ? 'bad' : undefined}
                        />
                        <Stat label="Response time" value={summary.response_avg_ms === null ? '—' : ms(summary.response_avg_ms)} hint={summary.response_peak_ms ? `Slowest ${ms(summary.response_peak_ms)}` : undefined} />
                        <Stat label="CPU" value={summary.cpu_avg === null ? '—' : percent(summary.cpu_avg)} hint={summary.cpu_peak !== null ? `Peak ${percent(summary.cpu_peak)} of ${data.limits.cpu_percent}% allowed` : undefined} />
                        <Stat label="Memory" value={summary.memory_avg_mb === null ? '—' : mb(summary.memory_avg_mb)} hint={summary.memory_peak_mb ? `Peak ${mb(summary.memory_peak_mb)} of ${mb(data.limits.memory_mb)}` : undefined} />
                    </div>
                    <div className="mt-gap grid gap-gap lg:grid-cols-2">
                        <AvailabilityStrip points={points} className="lg:col-span-2" />
                        <MetricChart title="Response time" points={series((p) => p.response_ms)} format={ms} tone="success" />
                        <MetricChart title="CPU" points={series((p) => p.cpu)} format={percent} limit={data.limits.cpu_percent} limitLabel="Plan" />
                        <MetricChart title="Memory" points={series((p) => p.memory_mb)} format={mb} limit={data.limits.memory_mb} limitLabel="Plan" />
                        <MetricChart title="Storage" points={series((p) => p.storage_mb)} format={mb} limit={data.limits.storage_mb} limitLabel="Plan" tone="warning" />
                        {points.some((p) => p.users !== null) && (
                            <MetricChart
                                title="Active users"
                                points={series((p) => p.users)}
                                format={(value) => String(Math.round(value))}
                                limit={data.limits.users}
                                limitLabel="Seats"
                            />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
