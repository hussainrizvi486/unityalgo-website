'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ArrowUpRight, Check, Copy, Download, LifeBuoy, LoaderCircle, Play, RefreshCw, Square,
} from 'lucide-react';
import type { CustomerSite, SiteBackups, SiteUsage } from '@/lib/controller-client';
import { siteActionAction } from '../../actions';
import { DeleteSite } from './delete-site';
import { ChangePlan, ResetPassword, type PlanChoice } from './site-dialogs';
import { SiteBackupsPanel } from './site-backups';
import { SiteDomainsPanel } from './site-domains';

export type { PlanChoice };
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Action = 'stop' | 'start' | 'restart' | 'backup' | 'deactivate' | 'reactivate';

const STATUS: Record<string, { label: string; variant: 'success' | 'neutral' | 'warning' | 'info' }> = {
    ready: { label: 'Active', variant: 'success' },
    stopped: { label: 'Stopped', variant: 'neutral' },
    stopping: { label: 'Stopping', variant: 'warning' },
    restarting: { label: 'Restarting', variant: 'info' },
    restoring: { label: 'Restoring', variant: 'info' },
    updating: { label: 'Updating', variant: 'info' },
    deactivated: { label: 'Deactivated', variant: 'neutral' },
};

function Submit({ label, icon, variant, disabled }: {
    label: string; icon: React.ReactNode; variant?: 'outline' | 'default'; disabled?: boolean;
}) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant={variant ?? 'outline'} size="sm" disabled={disabled || pending}>
            {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : icon}
            {label}
        </Button>
    );
}

/** One site action as a form, optionally behind a confirmation dialog. */
function ActionForm({ site, action, label, icon, disabled, confirm, onDone, variant, block }: {
    site: CustomerSite; action: Action; label: string; icon: React.ReactNode; disabled?: boolean;
    confirm?: { title: string; body: string }; onDone: () => void; variant?: 'outline' | 'default'; block?: boolean;
}) {
    const [state, formAction] = useActionState(siteActionAction, undefined);
    const form = useRef<HTMLFormElement>(null);
    const seen = useRef(state);
    useEffect(() => {
        if (state !== seen.current) {
            seen.current = state;
            if (state?.success) onDone();
        }
    }, [state, onDone]);
    return (
        <form ref={form} action={formAction} className={block ? 'w-full' : undefined}>
            <input type="hidden" name="siteId" value={site.id} />
            <input type="hidden" name="action" value={action} />
            {confirm ? (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant={variant ?? 'outline'} size="sm" disabled={disabled} className={block ? 'w-full justify-start' : undefined}>
                            {icon}{label}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
                            <AlertDialogDescription>{confirm.body}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => form.current?.requestSubmit()}>{label}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : (
                <Submit label={label} icon={icon} variant={variant} disabled={disabled} />
            )}
            {state?.error && <p role="alert" className="mt-2 text-xs text-destructive">{state.error}</p>}
        </form>
    );
}

function Stat({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
    return (
        <div className="rounded-xl border border-border p-card">
            <p className="portal-text-caption text-muted-foreground">{title}</p>
            <div className="mt-2">{children}</div>
            {hint && <p className="mt-1 portal-text-caption text-muted-foreground">{hint}</p>}
        </div>
    );
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
    return (
        <div>
            <div className="flex items-center justify-between portal-text-body">
                <span className="text-foreground/70">{label}</span>
                <span className="font-medium">{text}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(1, value))}%` }} />
            </div>
        </div>
    );
}

export function SiteOverview({ site, applicationNames, plans, onChange }: {
    site: CustomerSite; applicationNames: Record<string, string>; plans: PlanChoice[]; onChange: () => void;
}) {
    const status = STATUS[site.status] ?? { label: site.status, variant: 'neutral' as const };
    const running = site.status === 'ready';
    const deactivated = site.status === 'deactivated';
    const limits = site.limits;
    const overLimit = limits.state && limits.state !== 'ok';
    const idle = !site.activity;
    const apps = site.apps.map((app) => applicationNames[app] || app);

    const [usage, setUsage] = useState<SiteUsage | null>(null);
    const [usageError, setUsageError] = useState(false);
    const [backups, setBackups] = useState<SiteBackups | null>(null);
    const [backupsError, setBackupsError] = useState(false);
    const [copied, setCopied] = useState(false);

    // Re-measure whenever the site settles into a new state.
    useEffect(() => {
        if (!['ready', 'stopped'].includes(site.status)) return;
        const abort = new AbortController();
        fetch(`/api/customer/sites/${site.id}/usage`, { signal: abort.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then((value: SiteUsage) => { setUsage(value); setUsageError(false); })
            .catch(() => { if (!abort.signal.aborted) setUsageError(true); });
        return () => abort.abort();
    }, [site.id, site.status]);

    // The list changes when a backup finishes (activity clears) or the site starts.
    useEffect(() => {
        if (!running || site.activity) return;
        const abort = new AbortController();
        fetch(`/api/customer/sites/${site.id}/backups`, { signal: abort.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then((value: SiteBackups) => { setBackups(value); setBackupsError(false); })
            .catch(() => { if (!abort.signal.aborted) setBackupsError(true); });
        return () => abort.abort();
    }, [site.id, running, site.activity, site.updated_at]);

    const storageGb = usage ? usage.storage_mb / 1024 : null;

    return (
        <div className="mx-auto portal-detail">
            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <Link href="/dashboard/sites" className="portal-text-body text-muted-foreground hover:underline">Back to sites</Link>
                    <h1 className="portal-page-title mt-4">{site.name}</h1>
                    <p className="mt-2 break-all portal-text-body text-foreground/70">{site.domain}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" disabled={!running}>
                        <a href={site.url} target="_blank" rel="noopener noreferrer" aria-disabled={!running}>
                            <ArrowUpRight className="size-4" />Access site
                        </a>
                    </Button>
                    {deactivated ? (
                        <ActionForm site={site} action="reactivate" label="Reactivate" icon={<Play className="size-4" />} variant="default" onDone={onChange} />
                    ) : site.status === 'stopped' ? (
                        <ActionForm site={site} action="start" label="Start" icon={<Play className="size-4" />} onDone={onChange} />
                    ) : (
                        <ActionForm
                            site={site} action="stop" label="Stop" icon={<Square className="size-4" />}
                            disabled={!running || !idle} onDone={onChange}
                            confirm={{ title: 'Stop this site?', body: 'Your ERP will be unavailable to everyone until you start it again. Your data is kept.' }}
                        />
                    )}
                    {!deactivated && (
                        <ActionForm
                            site={site} action="restart" label="Restart" icon={<RefreshCw className="size-4" />}
                            disabled={!running || !idle} onDone={onChange}
                            confirm={{ title: 'Restart this site?', body: 'The site will be unavailable for a minute or two while its services restart.' }}
                        />
                    )}
                </div>
            </div>

            {site.error && (
                <Notice tone="warning" className="mt-6">{site.error}</Notice>
            )}
            {overLimit && (
                <Notice tone="warning" className="mt-6">
                    {limits.state === 'users' || limits.state === 'both'
                        ? `Your site has ${limits.user_count} active users but ${site.plan_name} allows ${site.resources.users}. Disable some users or change plan. `
                        : ''}
                    {limits.state === 'storage' || limits.state === 'both'
                        ? `Your site uses ${((limits.storage_used_mb ?? 0) / 1024).toFixed(2)} GB but ${site.plan_name} includes ${site.resources.storage_gb} GB. Remove files or change plan.`
                        : ''}
                </Notice>
            )}
            {deactivated && (
                <Notice tone="info" className="mt-6">
                    This site is deactivated: it is offline and not using any server capacity, and your data is kept. Reactivate it to use it again.
                </Notice>
            )}
            {['stopping', 'restarting', 'restoring', 'updating'].includes(site.status) && (
                <Notice tone="info" className="mt-6">{site.message}</Notice>
            )}

            <div className="mt-6 grid gap-gap sm:grid-cols-2 xl:grid-cols-4">
                <Stat title="Status">
                    <Badge variant={status.variant}>{status.label}</Badge>
                </Stat>
                <Stat title="Plan" hint={`${site.resources.vcpu} vCPU · ${site.resources.ram_mb / 1024} GB RAM · ${site.resources.storage_gb} GB`}>
                    <p className="text-xl font-semibold">{site.plan_name ?? '—'}</p>
                </Stat>
                <Stat title="Database" hint={site.db_server ? 'Shared database server' : 'Dedicated to this site'}>
                    <p className="text-xl font-semibold">{site.db_server ?? 'Own container'}</p>
                </Stat>
                <Stat title="Storage used" hint={usage ? undefined : usageError ? 'Not available right now' : 'Measuring…'}>
                    <p className="text-xl font-semibold">{storageGb != null ? `${storageGb.toFixed(2)} GB` : '—'}</p>
                </Stat>
            </div>

            <Tabs defaultValue="overview" className="mt-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="apps">Apps ({apps.length})</TabsTrigger>
                    <TabsTrigger value="backups">Backups</TabsTrigger>
                    <TabsTrigger value="domains">Domains &amp; SSL</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <div className="grid gap-gap lg:grid-cols-2">
                        <section className="rounded-xl border border-border p-card">
                            <h2 className="">Resource usage</h2>
                            <p className="mt-1 portal-text-caption text-muted-foreground">Measured live from your site&apos;s server.</p>
                            {usage ? (
                                <div className="mt-5 space-y-5">
                                    <Meter label="CPU" value={(usage.cpu_percent / (site.resources.vcpu * 100)) * 100} text={`${usage.cpu_percent.toFixed(1)}% of ${site.resources.vcpu} vCPU`} />
                                    <Meter label="Memory" value={(usage.memory_mb / site.resources.ram_mb) * 100} text={`${usage.memory_mb} MB of ${site.resources.ram_mb} MB`} />
                                    <Meter label="Storage" value={(usage.storage_mb / (site.resources.storage_gb * 1024)) * 100} text={`${(usage.storage_mb / 1024).toFixed(2)} GB of ${site.resources.storage_gb} GB`} />
                                    {site.resources.users != null && limits.user_count != null && (
                                        <Meter label="Users" value={(limits.user_count / site.resources.users) * 100} text={`${limits.user_count} of ${site.resources.users} users`} />
                                    )}
                                </div>
                            ) : (
                                <p className="mt-5 portal-text-body text-muted-foreground">
                                    {usageError ? 'Usage could not be read right now.' : 'Measuring…'}
                                </p>
                            )}
                        </section>

                        <section className="rounded-xl border border-border p-card">
                            <h2 className="">Your site login</h2>
                            <p className="mt-1 portal-text-caption text-muted-foreground">Sign in with the email and password you chose during setup.</p>
                            <div className="mt-5 flex items-center justify-between gap-3">
                                <span className="portal-text-body text-foreground/70">Email</span>
                                <span className="flex items-center gap-2 font-mono portal-text-body">
                                    {site.owner_email ?? '—'}
                                    {site.owner_email && (
                                        <button
                                            type="button" aria-label="Copy email"
                                            onClick={() => {
                                                void navigator.clipboard.writeText(site.owner_email!);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 1500);
                                            }}
                                        >
                                            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                        </button>
                                    )}
                                </span>
                            </div>
                            <p className="mt-5 portal-text-body text-foreground/70">Available to you</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {apps.map((app) => <Badge key={app} variant="neutral">{app}</Badge>)}
                            </div>
                        </section>

                        <section className="rounded-xl border border-border p-card lg:col-span-2">
                            <h2 className="">Site actions</h2>
                            <p className="mt-1 portal-text-caption text-muted-foreground">Everyday operations for your site.</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                <ActionForm
                                    site={site} action="backup" label={site.activity === 'backup' ? 'Backing up…' : 'Back up now'}
                                    icon={<Download className="size-4" />} disabled={!running || !idle} onDone={onChange} block
                                />
                                <ChangePlan site={site} plans={plans} onDone={onChange} />
                                <ResetPassword site={site} onDone={onChange} />
                                <Button asChild variant="outline" size="sm" className="justify-start">
                                    <Link href="/dashboard/support/new"><LifeBuoy className="size-4" />Contact support</Link>
                                </Button>
                            </div>
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="apps" className="mt-4">
                    <section className="rounded-xl border border-border p-card">
                        <h2 className="">Installed applications</h2>
                        <ul className="mt-4 divide-y divide-border/60">
                            {apps.map((app) => (
                                <li key={app} className="flex items-center justify-between py-3 portal-text-body">
                                    {app}<Badge variant="success">Installed</Badge>
                                </li>
                            ))}
                        </ul>
                    </section>
                </TabsContent>

                <TabsContent value="domains" className="mt-4">
                    <SiteDomainsPanel site={site} />
                </TabsContent>

                <TabsContent value="backups" className="mt-4">
                    <section className="rounded-xl border border-border p-card">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="">Backups</h2>
                                <p className="mt-1 portal-text-caption text-muted-foreground">Database and files, kept on your site&apos;s server.</p>
                            </div>
                            <ActionForm
                                site={site} action="backup" label={site.activity === 'backup' ? 'Backing up…' : 'Back up now'}
                                icon={<Download className="size-4" />} disabled={!running || !idle} onDone={onChange}
                            />
                        </div>
                        <SiteBackupsPanel site={site} backups={backups} error={backupsError} onChange={onChange} />
                    </section>
                </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-gap">
                {!deactivated && (
                    <section className="rounded-xl border border-border p-card">
                        <h2 className="">Deactivate site</h2>
                        <p className="mt-1 portal-text-caption text-muted-foreground">
                            Takes the site offline and frees its server capacity while keeping all your data. You can reactivate it later.
                        </p>
                        <div className="mt-4">
                            <ActionForm
                                site={site} action="deactivate" label="Deactivate site" icon={<Square className="size-4" />}
                                disabled={!['ready', 'stopped'].includes(site.status) || !idle} onDone={onChange}
                                confirm={{ title: 'Deactivate this site?', body: 'It goes offline for everyone. Your data and backups are kept, and you can reactivate it whenever there is room on the server.' }}
                            />
                        </div>
                    </section>
                )}
                <DeleteSite site={site} onDone={onChange} />
            </div>
        </div>
    );
}
