import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { controller, ControllerError, type SiteUsage } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { adminSiteActionAction, adminSiteTrialAction, forceDeleteSiteAction } from '@/app/admin/controller-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/admin/delete-button';
import { MonitoringPanel } from '@/components/ui/monitoring-panel';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { OPERATION_STATUS_BADGE, humanizeStatus } from '@/lib/controller-status';
import { formatDateTime } from '@/lib/admin-format';

export const metadata = { title: 'Site' };

type Variant = 'neutral' | 'success' | 'info' | 'warning' | 'error';
const statusBadge = (status: string): { label: string; variant: Variant } =>
    status === 'ready' ? { label: 'Active', variant: 'success' }
    : status === 'stopped' || status === 'deactivated' ? { label: humanizeStatus(status), variant: 'neutral' }
    : ['failed', 'cleanup_required'].includes(status) ? { label: humanizeStatus(status), variant: 'error' }
    : { label: humanizeStatus(status), variant: 'info' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border p-card">
            <h2 className="">{title}</h2>
            <dl className="mt-3 space-y-2 portal-text-body">{children}</dl>
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-gap">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all text-right font-medium">{children}</dd>
        </div>
    );
}

function ActionButton({ id, action, label, disabled }: { id: string; action: string; label: string; disabled?: boolean }) {
    return (
        <form action={adminSiteActionAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value={action} />
            <Button type="submit" variant="outline" size="sm" disabled={disabled}>{label}</Button>
        </form>
    );
}

export default async function AdminSiteDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string }>;
}) {
    await requireAdmin();
    const { id } = await params;
    const query = await searchParams;

    let detail;
    try {
        detail = await controller.sites.adminGet(id);
    } catch (error) {
        if (error instanceof ControllerError) {
            if (error.status === 404) notFound();
            return <ControllerOffline message={error.message} />;
        }
        throw error;
    }
    const { site, server, database, infrastructure, domains, backups, operations } = detail;
    const running = site.status === 'ready';
    const idle = !site.activity;

    // Live figures cost an SSH round trip; skip them for a site that is not running.
    let usage: SiteUsage | null = null;
    if (['ready', 'stopped'].includes(site.status)) {
        usage = await controller.sites.adminUsage(id).catch(() => null);
    }
    const badge = statusBadge(site.status);

    return (
        <div className="portal-detail">
            <Link href="/admin/sites" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to sites
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-gap">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{site.name}</h1>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {site.activity && <Badge variant="info">{site.activity}</Badge>}
                    </div>
                    <p className="mt-1 break-all portal-text-body text-muted-foreground">{site.domain}</p>
                    <p className="mt-1 portal-text-caption text-muted-foreground">{site.message}</p>
                </div>
                {running && (
                    <Button asChild size="sm" variant="outline">
                        <a href={site.url} target="_blank" rel="noopener noreferrer">Open site <ArrowUpRight className="size-4" /></a>
                    </Button>
                )}
            </div>
            {query.error && <AdminPageError message={query.error} />}
            {query.done && <AdminPageNotice message={query.done} />}
            {site.error && <AdminPageError message={site.error} />}

            <div className="mt-6 grid gap-gap md:grid-cols-2 xl:grid-cols-3">
                <Card title="Owner">
                    <Row label="Account">{site.owner_account_email}</Row>
                    <Row label="Site login">{site.owner_email ?? '—'}</Row>
                    <Row label="Plan">{site.plan_name ?? '—'}</Row>
                    <Row label="Created">{formatDateTime(site.created_at)}</Row>
                    <Row label="Attempt">{site.attempt}</Row>
                    {site.trial && (
                        <Row label="Free trial">
                            <Badge variant={site.trial.expired ? 'error' : 'info'}>
                                {site.trial.expired ? 'Ended' : `${site.trial.days_left} day${site.trial.days_left === 1 ? '' : 's'} left`}
                            </Badge>
                            <div className="portal-text-caption font-normal text-muted-foreground">{site.trial.expired ? 'ended' : 'ends'} {formatDateTime(site.trial.ends_at)}</div>
                        </Row>
                    )}
                </Card>
                <Card title="Hosting">
                    <Row label="Worker"><Link href={`/admin/servers/${server.id}`} className="text-primary hover:underline">{server.name}</Link></Row>
                    <Row label="Address">{server.ip_address}:{server.port}</Row>
                    <Row label="Worker health">{server.status ?? 'unknown'}</Row>
                    <Row label="Database">{database ? `${database.name} (${database.engine})` : 'Own container'}</Row>
                </Card>
                <Card title="Plan limits and use">
                    <Row label="CPU">{site.resources.vcpu} vCPU{usage ? ` · ${usage.cpu_percent.toFixed(1)}% used` : ''}</Row>
                    <Row label="Memory">{site.resources.ram_mb} MB{usage ? ` · ${usage.memory_mb} MB used` : ''}</Row>
                    <Row label="Storage">{site.resources.storage_gb} GB{usage ? ` · ${(usage.storage_mb / 1024).toFixed(2)} GB used` : ''}</Row>
                    <Row label="Users">{site.resources.users ?? 'Unlimited'}{site.limits.user_count != null ? ` · ${site.limits.user_count} active` : ''}</Row>
                    <Row label="Limit state">
                        <Badge variant={!site.limits.state || site.limits.state === 'ok' ? 'success' : 'warning'}>{site.limits.state ?? 'not audited'}</Badge>
                    </Row>
                    {site.limits.audited_at && <Row label="Audited">{formatDateTime(site.limits.audited_at)}</Row>}
                </Card>
            </div>

            <section className="mt-4 rounded-xl border border-border p-card">
                <h2 className="">Containers and identifiers</h2>
                <dl className="mt-3 grid gap-x-gap gap-y-2 portal-text-body md:grid-cols-2">
                    <Row label="Site ID"><span className="font-mono text-sm">{infrastructure.site_id}</span></Row>
                    <Row label="Slug"><span className="font-mono text-sm">{infrastructure.slug}</span></Row>
                    <Row label="Compose project"><span className="font-mono text-sm">{infrastructure.compose_project}</span></Row>
                    <Row label="Directory on worker"><span className="font-mono text-sm">{infrastructure.path}</span></Row>
                    <Row label="Image"><span className="font-mono text-sm">{infrastructure.image}</span></Row>
                    <Row label="Site port">{infrastructure.port}</Row>
                </dl>
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full portal-text-body">
                        <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                                <th className="py-2 pr-4 font-medium">Service</th>
                                <th className="py-2 pr-4 font-medium">Container name</th>
                                <th className="py-2 pr-4 text-right font-medium">Memory</th>
                                <th className="py-2 text-right font-medium">CPU</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {infrastructure.containers.map((container) => (
                                <tr key={container.name}>
                                    <td className="py-2 pr-4">{container.service}</td>
                                    <td className="py-2 pr-4 font-mono text-sm">{container.name}</td>
                                    <td className="py-2 pr-4 text-right">{container.memory_mb} MB</td>
                                    <td className="py-2 text-right">{container.cpus}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!database && <p className="mt-3 portal-text-caption text-muted-foreground">The db container runs inside this stack because no database server is attached.</p>}
            </section>

            <section className="mt-4 rounded-xl border border-border p-card">
                <h2 className="">Actions</h2>
                <p className="mt-1 portal-text-caption text-muted-foreground">The same actions the customer has, on their behalf. Each is logged under Operations below.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {site.status === 'stopped' && <ActionButton id={id} action="start" label="Start" />}
                    {site.status === 'deactivated' && <ActionButton id={id} action="reactivate" label="Reactivate" />}
                    <ActionButton id={id} action="stop" label="Stop" disabled={!running || !idle} />
                    <ActionButton id={id} action="restart" label="Restart" disabled={!running || !idle} />
                    <ActionButton id={id} action="backup" label="Back up now" disabled={!running || !idle} />
                    <ActionButton id={id} action="deactivate" label="Deactivate" disabled={!['ready', 'stopped'].includes(site.status) || !idle} />
                    {site.trial && (
                        <>
                            <form action={adminSiteTrialAction}>
                                <input type="hidden" name="id" value={id} />
                                <input type="hidden" name="days" value="7" />
                                <Button type="submit" variant="outline" size="sm">Extend trial 7 days</Button>
                            </form>
                            {!site.trial.expired && (
                                <form action={adminSiteTrialAction}>
                                    <input type="hidden" name="id" value={id} />
                                    <input type="hidden" name="end" value="1" />
                                    <Button type="submit" variant="outline" size="sm">End trial now</Button>
                                </form>
                            )}
                        </>
                    )}
                    <DeleteButton
                        action={forceDeleteSiteAction}
                        id={id}
                        title={`Delete ${site.name}?`}
                        description="Permanently removes the site, its containers, volumes and database from the server, pressing past any failing step. This cannot be undone."
                        disabled={site.status === 'deleting'}
                    />
                </div>
            </section>

            <div className="mt-4 grid gap-gap lg:grid-cols-2">
                <section className="rounded-xl border border-border p-card">
                    <h2 className="">Custom domains ({domains.length})</h2>
                    {domains.length ? (
                        <ul className="mt-3 divide-y divide-border/60">
                            {domains.map((domain) => (
                                <li key={domain.id} className="flex flex-wrap items-center justify-between gap-2 py-2 portal-text-body">
                                    <span className="font-mono">{domain.domain}</span>
                                    <span className="flex gap-2">
                                        <Badge variant={domain.status === 'active' ? 'success' : 'warning'}>{domain.status === 'active' ? 'Routed' : 'Waiting for DNS'}</Badge>
                                        {domain.status === 'active' && <Badge variant={domain.tls_status === 'active' ? 'success' : 'neutral'}>{domain.tls_status === 'active' ? 'HTTPS' : 'Certificate pending'}</Badge>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="mt-3 portal-text-body text-muted-foreground">None.</p>}
                </section>
                <section className="rounded-xl border border-border p-card">
                    <h2 className="">Backups</h2>
                    <p className="mt-1 portal-text-caption text-muted-foreground">
                        Schedule: {site.backup.schedule}{site.backup.schedule !== 'off' ? `, keeping ${site.backup.retention}` : ''}
                        {site.backup.last_at ? ` · last ${formatDateTime(site.backup.last_at)}` : ''}
                    </p>
                    {backups.length ? (
                        <ul className="mt-3 divide-y divide-border/60">
                            {backups.map((backup) => (
                                <li key={backup.stamp} className="flex items-center justify-between py-2 portal-text-body">
                                    <span className="font-mono text-sm">{backup.stamp}</span>
                                    <Badge variant={backup.kind === 'safety' ? 'warning' : backup.kind === 'scheduled' ? 'info' : 'neutral'}>{backup.kind}</Badge>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="mt-3 portal-text-body text-muted-foreground">No recorded backups.</p>}
                </section>
            </div>

            <MonitoringPanel className="mt-8" endpoint={`/api/admin/sites/${id}/metrics`} />

            <section className="mt-8 rounded-xl border border-border p-card">
                <h2 className="">Operations</h2>
                <p className="mt-1 portal-text-caption text-muted-foreground">Open one for the full error and traceback.</p>
                {operations.length ? (
                    <ul className="mt-3 divide-y divide-border/60">
                        {operations.map((operation) => (
                            <li key={operation.id} className="py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link href={`/admin/logs/${operation.id}`} className="font-medium hover:text-primary hover:underline">{operation.label}</Link>
                                    <span className="flex items-center gap-3 portal-text-caption text-muted-foreground">
                                        {operation.started_at ? formatDateTime(operation.started_at) : ''}
                                        {operation.duration_ms != null ? ` · ${(operation.duration_ms / 1000).toFixed(1)}s` : ''}
                                        <Badge variant={OPERATION_STATUS_BADGE[operation.status] ?? 'neutral'}>{humanizeStatus(operation.status)}</Badge>
                                    </span>
                                </div>
                                {operation.error && <p className="mt-1 break-all font-mono text-xs text-destructive">{operation.error}</p>}
                            </li>
                        ))}
                    </ul>
                ) : <p className="mt-3 portal-text-body text-muted-foreground">Nothing recorded yet.</p>}
            </section>
        </div>
    );
}
