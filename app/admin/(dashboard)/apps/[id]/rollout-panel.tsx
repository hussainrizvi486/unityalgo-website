'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startRolloutAction } from '@/app/admin/app-store-actions';
import type { AppInstallation } from '@/lib/controller-client';
import { ISOLATION_NOTE, versionLabel } from '@/lib/app-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Mode = 'update' | 'install';

interface Props {
    appId: string;
    appTitle: string;
    sites: AppInstallation[];
    /** Why nothing can be rolled out (incompatible branch, no repository…), or null. */
    blocked: string | null;
    /** True when Frappe support is not declared; the admin must confirm. */
    unverified: boolean;
}

function status(site: AppInstallation) {
    const installed = site.installed;
    if (!installed) return { label: 'Not installed', variant: 'neutral' as const, outdated: false };
    if (installed.up_to_date) return { label: 'Up to date', variant: 'success' as const, outdated: false };
    if (installed.up_to_date === false) {
        const behind = installed.commits_behind;
        return { label: behind ? `${behind} commit${behind === 1 ? '' : 's'} behind` : 'Update available', variant: 'warning' as const, outdated: true };
    }
    return { label: 'Version unknown', variant: 'neutral' as const, outdated: false };
}

/** Pick sites, then update or install. Only the sites ticked here are touched. */
export function RolloutPanel({ appId, appTitle, sites, blocked, unverified }: Props) {
    const router = useRouter();
    const running = sites.filter((site) => site.installed);
    const without = sites.filter((site) => !site.installed);
    const [picked, setPicked] = React.useState<Record<Mode, Set<string>>>({ update: new Set(), install: new Set() });
    const [confirming, setConfirming] = React.useState<{ mode: Mode; all: boolean } | null>(null);
    const [note, setNote] = React.useState('');
    const [accepted, setAccepted] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [pending, startTransition] = React.useTransition();

    const group = (mode: Mode) => (mode === 'update' ? running : without);
    const outdated = running.filter((site) => site.eligible && status(site).outdated);

    function toggle(mode: Mode, id: string, on: boolean) {
        setPicked((current) => {
            const next = new Set(current[mode]);
            if (on) next.add(id);
            else next.delete(id);
            return { ...current, [mode]: next };
        });
    }

    function select(mode: Mode, predicate: (site: AppInstallation) => boolean) {
        setPicked((current) => ({ ...current, [mode]: new Set(group(mode).filter((site) => site.eligible && predicate(site)).map((site) => site.id)) }));
    }

    function begin(mode: Mode, all: boolean) {
        setError(null);
        setAccepted(false);
        setConfirming({ mode, all });
    }

    function confirm() {
        if (!confirming) return;
        const { mode, all } = confirming;
        const ids = all ? outdated.map((site) => site.id) : [...picked[mode]];
        startTransition(async () => {
            const result = await startRolloutAction({
                appId,
                action: mode,
                siteIds: ids,
                allowUnverified: accepted,
                note: note.trim() || undefined,
            });
            if (result.error || !result.id) {
                setError(result.error ?? 'The rollout could not be started.');
                return;
            }
            router.push(`/admin/apps/rollouts/${result.id}`);
        });
    }

    const targetCount = confirming ? (confirming.all ? outdated.length : picked[confirming.mode].size) : 0;
    const targets = confirming
        ? (confirming.all ? outdated : group(confirming.mode).filter((site) => picked[confirming.mode].has(site.id)))
        : [];

    // A plain function, not a component: a component declared here would remount on every tick of state.
    function siteTable(mode: Mode) {
        const rows = group(mode);
        const chosen = picked[mode];
        const eligible = rows.filter((site) => site.eligible);
        return (
            <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                    {mode === 'update' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => select('update', (site) => status(site).outdated)} disabled={!outdated.length}>
                            Select outdated ({outdated.length})
                        </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => select(mode, () => true)} disabled={!eligible.length}>Select all ({eligible.length})</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => select(mode, () => false)} disabled={!chosen.size}>Clear</Button>
                    <div className="ml-auto flex flex-wrap gap-2">
                        {mode === 'update' && (
                            <Button type="button" size="sm" variant="outline" disabled={!!blocked || !outdated.length} onClick={() => begin('update', true)}>
                                Update all outdated ({outdated.length})
                            </Button>
                        )}
                        <Button type="button" size="sm" disabled={!!blocked || !chosen.size} onClick={() => begin(mode, false)}>
                            {mode === 'update' ? 'Update' : 'Install on'} selected ({chosen.size})
                        </Button>
                    </div>
                </div>
                <div className="mt-3 rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10" />
                                <TableHead>Site</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>{mode === 'update' ? 'Running' : 'Frappe image'}</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((site) => {
                                const state = status(site);
                                return (
                                    <TableRow key={site.id} className={site.eligible ? undefined : 'opacity-60'}>
                                        <TableCell>
                                            <Checkbox
                                                aria-label={`Select ${site.name}`}
                                                checked={chosen.has(site.id)}
                                                disabled={!site.eligible || !!blocked}
                                                onCheckedChange={(on) => toggle(mode, site.id, on === true)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/admin/sites/${site.id}`} className="font-medium hover:text-primary hover:underline">{site.name}</Link>
                                            <div className="portal-text-caption text-muted-foreground">{site.domain}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{site.owner_email ?? '—'}</div>
                                            <div className="portal-text-caption text-muted-foreground">{site.plan_name ?? '—'}{site.server_name ? ` · ${site.server_name}` : ''}</div>
                                        </TableCell>
                                        <TableCell>
                                            {mode === 'update'
                                                ? <>{versionLabel(site.installed?.version, site.installed?.commit)}{site.installed?.branch && <div className="portal-text-caption text-muted-foreground">{site.installed.branch}</div>}</>
                                                : <span className="portal-text-caption text-muted-foreground">{site.image.split('/').pop()}</span>}
                                        </TableCell>
                                        <TableCell>
                                            {site.eligible
                                                ? <Badge variant={state.variant}>{state.label}</Badge>
                                                : <><Badge variant="neutral">Unavailable</Badge><div className="mt-1 portal-text-caption text-muted-foreground">{site.reason}</div></>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-gap-xl">
            {blocked && <Notice tone="warning">{blocked}</Notice>}
            <section>
                <h3 className="">Sites running {appTitle} <span className="font-normal text-muted-foreground">({running.length})</span></h3>
                {running.length ? siteTable('update') : (
                    <p className="mt-2 portal-text-body text-muted-foreground">No site is running this app yet. Install it on a site below, or rescan if you installed it by hand.</p>
                )}
            </section>
            <section>
                <h3 className="">Sites without {appTitle} <span className="font-normal text-muted-foreground">({without.length})</span></h3>
                {without.length ? siteTable('install') : <p className="mt-2 portal-text-body text-muted-foreground">Every site already has this app.</p>}
            </section>

            <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !pending && setConfirming(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming?.mode === 'install' ? 'Install' : 'Update'} {appTitle} on {targetCount} site{targetCount === 1 ? '' : 's'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p className="portal-text-caption">{targets.slice(0, 6).map((site) => site.name).join(', ')}{targets.length > 6 ? ` and ${targets.length - 6} more` : ''}.</p>
                                <p>{ISOLATION_NOTE}</p>
                                <p>Each site is briefly unavailable while its database is migrated.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note for the rollout history (optional)" maxLength={500} />
                    {unverified && (
                        <label className="flex items-start gap-2 portal-text-body">
                            <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                            This branch does not declare which Frappe version it supports. I have checked that it works with the Frappe version the sites run.
                        </label>
                    )}
                    {error && <Notice tone="error">{error}</Notice>}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button
                                type="button"
                                disabled={pending || (unverified && !accepted) || !targetCount}
                                onClick={(event) => {
                                    event.preventDefault();      // stay open until the controller answers, so an error can be shown
                                    confirm();
                                }}
                            >
                                {pending ? 'Starting…' : `Start ${confirming?.mode ?? 'update'}`}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
