import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { retryRolloutAction } from '@/app/admin/app-store-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { formatDateTime } from '@/lib/admin-format';
import { ISOLATION_NOTE, rolloutBadge, rolloutSiteBadge, shortSha, versionLabel } from '@/lib/app-store';
import { AutoRefresh } from './auto-refresh';

export const metadata = { title: 'Rollout' };

export default async function RolloutPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string }>;
}) {
    await requireAdmin();
    const { id } = await params;
    const query = await searchParams;

    let rollout;
    try {
        rollout = await controller.apps.rollout(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            if (error.status === 404) notFound();
            return <ControllerOffline message={error.message} />;
        }
        throw error;
    }
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.frappeAppName, rollout.app_name) });
    const badge = rolloutBadge(rollout.status);
    const sites = rollout.sites ?? [];
    const finished = rollout.counts.success + rollout.counts.failed + rollout.counts.skipped;
    const retryable = rollout.counts.failed + rollout.counts.skipped;
    const verb = rollout.action === 'install' ? 'Install' : 'Update';

    return (
        <div className="portal-detail">
            <AutoRefresh active={rollout.status === 'running'} />
            <Link href={app ? `/admin/apps/${app.id}` : '/admin/apps'} className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to {app?.name ?? 'App Store'}
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="portal-page-title">{verb} {app?.name ?? rollout.app_name}</h1>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="mt-1 portal-text-body text-muted-foreground">
                        To {versionLabel(rollout.target_version, rollout.target_commit)} from {rollout.branch} · started {formatDateTime(rollout.created_at)}
                        {rollout.created_by ? ` by ${rollout.created_by}` : ''}
                        {rollout.finished_at ? ` · finished ${formatDateTime(rollout.finished_at)}` : ''}
                    </p>
                    {rollout.note && <p className="mt-1 portal-text-caption text-muted-foreground">Note: {rollout.note}</p>}
                </div>
                {retryable > 0 && rollout.status !== 'running' && (
                    <form action={retryRolloutAction}>
                        <input type="hidden" name="id" value={rollout.id} />
                        <Button type="submit"><RotateCcw className="size-4" />Retry {retryable} site{retryable === 1 ? '' : 's'}</Button>
                    </form>
                )}
            </div>
            {query.error && <AdminPageError message={query.error} />}
            {query.done && <AdminPageNotice message={query.done} />}

            <div className="mt-6 rounded-xl border border-border p-card">
                <div className="flex flex-wrap items-center justify-between gap-2 portal-text-body">
                    <span className="font-medium">{finished} of {rollout.site_count} site{rollout.site_count === 1 ? '' : 's'} finished</span>
                    <span className="text-muted-foreground">
                        {rollout.counts.success} done · {rollout.counts.running} updating · {rollout.counts.pending} waiting
                        {rollout.counts.failed ? ` · ${rollout.counts.failed} failed` : ''}
                        {rollout.counts.skipped ? ` · ${rollout.counts.skipped} skipped` : ''}
                    </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${rollout.site_count ? (finished / rollout.site_count) * 100 : 0}%` }} />
                </div>
            </div>
            <Notice tone="info" className="mt-4">{ISOLATION_NOTE}</Notice>

            <div className="mt-6 space-y-3">
                {sites.map((row) => {
                    const state = rolloutSiteBadge(row.status);
                    const active = row.status === 'running' || row.status === 'pending';
                    return (
                        <section key={row.id} className="rounded-xl border border-border p-card">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <Link href={`/admin/sites/${row.site_id}`} className="font-semibold hover:text-primary hover:underline">{row.site_slug}</Link>
                                    <div className="portal-text-caption text-muted-foreground">
                                        {rollout.action === 'install' ? 'Not installed' : versionLabel(row.from_version, row.from_commit)} → {versionLabel(row.to_version ?? rollout.target_version, row.to_commit ?? rollout.target_commit)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {row.rolled_back && <Badge variant="warning">Rolled back</Badge>}
                                    <Badge variant={state.variant}>{state.label}</Badge>
                                </div>
                            </div>
                            {active ? (
                                <div className="mt-3">
                                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                        <div className="h-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
                                    </div>
                                    <p className="mt-1 portal-text-caption text-muted-foreground">{row.step ?? 'Waiting in the queue'}</p>
                                </div>
                            ) : (
                                <p className="mt-2 portal-text-caption text-muted-foreground">{row.step}</p>
                            )}
                            {row.error && (
                                <Notice tone="error" className="mt-3">
                                    <div className="font-medium">
                                        {row.rolled_back ? 'The update failed and the site was returned to how it was.' : row.status === 'skipped' ? 'Skipped.' : 'The update failed.'}
                                    </div>
                                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{row.error}</pre>
                                    {row.backup_stamp && <p className="mt-2 text-xs">Safety backup {row.backup_stamp} is kept on the site.</p>}
                                </Notice>
                            )}
                            <div className="mt-3 flex flex-wrap gap-gap portal-text-caption">
                                {row.log && (
                                    <details className="w-full">
                                        <summary className="cursor-pointer font-medium text-primary">Progress log</summary>
                                        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{row.log}</pre>
                                    </details>
                                )}
                                {row.operation_id && <Link href={`/admin/logs/${row.operation_id}`} className="font-medium text-primary hover:underline">Full operation log</Link>}
                                {row.to_commit && row.status === 'success' && <span className="text-muted-foreground">Now at {shortSha(row.to_commit)}</span>}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
