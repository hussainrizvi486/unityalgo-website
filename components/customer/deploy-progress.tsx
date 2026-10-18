'use client';
import * as React from 'react';
import { Box, Check, CircleAlert, Download, FlaskConical, Globe, Rocket, X } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { Badge } from '@/components/ui/badge';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    pulling: Download,
    configuring: Box,
    installing: FlaskConical,
    starting: Rocket,
    routing: Globe,
};

/** What each step is doing, shown under its title. */
const DETAIL: Record<string, string> = {
    pulling: 'Downloading the AlgoSuite platform',
    configuring: 'Setting up the database and background services',
    installing: 'Creating your site, company and applications',
    starting: 'Starting the application and checking its health',
    routing: 'Connecting your site address',
};

const TYPICAL_SECONDS: Record<string, number> = { pulling: 40, configuring: 25, installing: 150, starting: 30, routing: 10 };

function duration(ms: number) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function DeployProgress({ site }: { site: CustomerSite }) {
    const failed = site.status === 'failed' || site.status === 'cleanup_required';
    const finished = site.status === 'ready';
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (failed || finished) return;
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [failed, finished]);

    const steps = site.steps;
    const total = steps.length;
    const activeIndex = Math.max(0, steps.findIndex((step) => step.state === 'active' || step.state === 'failed'));
    const doneCount = steps.filter((step) => step.state === 'done').length;
    const started = Date.parse(site.created_at);
    const stopped = failed || finished ? Date.parse(site.updated_at) : now;
    const enteredActive = Date.parse(site.updated_at);

    const pillVariant = failed ? 'error' : finished ? 'success' : 'neutral';
    const pillText = failed ? 'Failed' : finished ? 'Live' : 'Running';

    return (
        <section
            data-finished={finished || failed ? '' : undefined}
            className="deploy-card mt-6 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
        >
            <div className="flex items-start justify-between gap-3 p-card pb-gap">
                <div>
                    <h2 className="font-semibold leading-none tracking-tight">{finished ? 'Deployed' : failed ? 'Deployment stopped' : 'Deploying'} {site.name}</h2>
                    <p className="mt-1.5 portal-text-body text-muted-foreground">{site.plan_name ? `${site.plan_name} plan · ` : ''}{site.domain}</p>
                </div>
                <Badge variant={pillVariant}>{pillText}</Badge>
            </div>

            <div className="px-card pb-card">
                <div className="mb-2 flex items-baseline justify-between portal-text-body">
                    <span className="font-medium" role="status">
                        {finished ? 'Deployed successfully' : failed ? 'Needs attention' : `Step ${Math.min(activeIndex + 1, total)} of ${total}`}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{site.progress}%</span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Site deployment"
                    aria-valuenow={site.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                    <div className="deploy-fill h-full w-full rounded-full bg-primary" style={{ '--p': site.progress / 100 } as React.CSSProperties} />
                </div>
            </div>

            <div className="h-px w-full bg-border" />

            <ol className="flex flex-col gap-gap-sm p-card">
                {steps.map((step) => {
                    const Icon = ICONS[step.key] ?? Globe;
                    const active = step.state === 'active';
                    const estimate = active
                        ? Math.min(0.95, 1 - Math.exp(-Math.max(0, now - enteredActive) / 1000 / (TYPICAL_SECONDS[step.key] ?? 30)))
                        : 0;
                    const share = step.state === 'done' ? 1 : estimate;
                    return (
                        <li
                            key={step.key}
                            data-state={step.state}
                            className="deploy-step relative flex gap-gap pb-gap"
                            style={{ '--sp': share } as React.CSSProperties}
                        >
                            <div className="deploy-node">
                                <span className="deploy-halo" />
                                <div className="deploy-face">
                                    {step.state === 'failed' ? <X className="size-4.5" /> : <Icon className="size-4.5" />}
                                </div>
                                <svg className="deploy-ring" viewBox="0 0 50 50" fill="none" aria-hidden="true">
                                    <circle cx="25" cy="25" r="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="36 109" />
                                </svg>
                                <span className="deploy-badge">
                                    <Check className="size-2.5" strokeWidth={4} aria-hidden="true" />
                                </span>
                            </div>
                            <div className="deploy-rail"><i /></div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="deploy-title portal-text-body font-medium leading-none">{step.label}</p>
                                    <span className="deploy-pill" data-v={step.state}>
                                        {step.state === 'done' ? 'Done' : step.state === 'failed' ? 'Failed' : active ? `${Math.round(estimate * 100)}%` : 'Pending'}
                                    </span>
                                </div>
                                <p className="mt-1.5 portal-text-body text-muted-foreground">{DETAIL[step.key]}</p>
                                <div className="deploy-mini"><i /></div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className="flex items-center justify-between gap-3 border-t border-border p-gap px-card">
                <span className="tabular-nums portal-text-body text-muted-foreground">
                    {Number.isFinite(started) ? `${duration(stopped - started)} elapsed` : ''}
                </span>
                <span className="portal-text-caption text-muted-foreground">
                    {failed ? (
                        <span className="inline-flex items-center gap-1.5"><CircleAlert className="size-3.5" />Stopped after {doneCount} of {total} steps</span>
                    ) : finished ? 'All steps complete' : `${doneCount} of ${total} steps done`}
                </span>
            </div>
        </section>
    );
}
