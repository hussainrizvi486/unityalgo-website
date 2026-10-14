import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft, CheckCircle2, Database, Globe, HardDriveDownload, Play, RefreshCw, Square,
} from 'lucide-react';
import {
    controller, ControllerError,
    type ControllerDatabase, type ControllerDomain, type ControllerServer, type ControllerTenant,
} from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import {
    deleteTenantAction, domainAction, restoreBackupAction, tenantLifecycleAction,
} from '@/app/admin/controller-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/admin/delete-button';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { DOMAIN_STATUS_BADGE, TENANT_STATUS_BADGE, TENANT_STATUS_LABEL } from '@/lib/controller-status';
import {
    TenantResizeForm, TenantMigrateForm, TenantDomainForm, TenantDatabaseMigrateForm,
} from './tenant-forms';
import { OperationProgress } from './operation-progress';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string; operation?: string }>;
}

const DONE_LABELS: Record<string, string> = {
    provision: 'Provisioning started.',
    redeploy: 'Redeploy started.',
    stop: 'Tenant stopped.',
    start: 'Tenant started.',
    'db-migrate': 'Schema migration job started.',
    backup: 'Backup started.',
    resize: 'Resource limits updated.',
    migrate: 'Migration to the new node started.',
    restore: 'Restore started.',
    'db-migrate-started': 'Database migration started.',
    'domain-added': 'Domain added.',
    'domain-activate': 'Domain activated.',
    'domain-verify': 'Domain verified.',
    'domain-disable': 'Domain disabled.',
    'domain-remove': 'Domain removed.',
};

interface BackupRow {
    id: string;
    status: string;
    reason: string | null;
    size_bytes: number | null;
    created_at: string;
    error_message: string | null;
}

export default async function TenantDetailPage({ params, searchParams }: PageProps) {
    await requireAdmin();
    const { id } = await params;
    const { error, done, operation } = await searchParams;

    let tenant: ControllerTenant;
    let domains: ControllerDomain[] = [];
    let backups: BackupRow[] = [];
    let servers: ControllerServer[] = [];
    let clusters: ControllerDatabase[] = [];

    try {
        tenant = await controller.tenants.get(id);
        // Independent reads — one failing shouldn't blank the whole page, so
        // they're settled rather than awaited together.
        const [domainsResult, backupsResult, serversResult, clustersResult] = await Promise.allSettled([
            controller.tenants.domains(id),
            controller.tenants.backups(id),
            controller.servers.list(),
            controller.databases.list(),
        ]);
        if (domainsResult.status === 'fulfilled') domains = domainsResult.value.results ?? [];
        if (backupsResult.status === 'fulfilled') backups = (backupsResult.value.results ?? []) as unknown as BackupRow[];
        if (serversResult.status === 'fulfilled') servers = serversResult.value.results ?? [];
        if (clustersResult.status === 'fulfilled') {
            clusters = (clustersResult.value.results ?? []).filter((db) => db.role === 'cluster');
        }
    } catch (err) {
        if (err instanceof ControllerError) {
            if (err.status === 404) notFound();
            return <ControllerOffline message={err.message} />;
        }
        throw err;
    }

    const isRunning = tenant.status === 'active';
    const neverProvisioned = tenant.status === 'pending';

    return (
        <div className="portal-detail">
            <Link href="/admin/tenants" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-ink-500 hover:text-ink-700">
                <ArrowLeft className="h-4 w-4" />Back to tenants
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{tenant.tenant_slug}</h1>
                        <Badge variant={TENANT_STATUS_BADGE[tenant.status]}>{TENANT_STATUS_LABEL[tenant.status]}</Badge>
                    </div>
                    <p className="mt-1 portal-text-body text-ink-500">
                        {tenant.customer?.email ?? tenant.customer_email} ·{' '}
                        {tenant.subscription?.plan?.name ?? tenant.plan_tier} ·{' '}
                        {tenant.memory_limit_mb} MB · {tenant.cpu_limit_cores} CPU
                    </p>
                </div>
            </div>

            {error && <div className="mt-6 rounded-md bg-error-50 px-3.5 py-2.5 portal-text-body text-error-700">{error}</div>}
            {done && (
                <div className="mt-6 flex items-center gap-2 rounded-md bg-success-50 px-3.5 py-2.5 portal-text-body text-success-700">
                    <CheckCircle2 className="h-4 w-4" />{DONE_LABELS[done] ?? 'Done.'}
                </div>
            )}

            {/* Long-running work continues on a Celery worker, so poll it here
                rather than blocking the action that started it. */}
            {operation ? <OperationProgress operationId={operation} /> : null}

            {/* --- account --- */}
            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="font-bold text-ink-900">Account</h2>
                <p className="mt-1 portal-text-caption text-ink-400">
                    Who this store belongs to and what they are paying for. Both come from the linked
                    subscription.
                </p>

                {tenant.customer ? (
                    <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                            <dt className="portal-text-caption font-semibold uppercase tracking-wide text-ink-400">Customer</dt>
                            <dd className="mt-1">
                                <Link
                                    href={`/admin/users/${tenant.customer.id}`}
                                    className="font-medium text-ink-900 hover:text-link hover:underline"
                                >
                                    {tenant.customer.name}
                                </Link>
                                <div className="portal-text-body text-ink-500">{tenant.customer.email}</div>
                                {tenant.customer.company && (
                                    <div className="portal-text-body text-ink-500">{tenant.customer.company}</div>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="portal-text-caption font-semibold uppercase tracking-wide text-ink-400">Plan</dt>
                            <dd className="mt-1">
                                {tenant.subscription?.plan ? (
                                    <>
                                        <div className="font-medium text-ink-900">{tenant.subscription.plan.name}</div>
                                        <div className="portal-text-body text-ink-500">
                                            {tenant.subscription.plan.price_amount === null
                                                ? 'Custom pricing'
                                                : `$${tenant.subscription.plan.price_amount}`}
                                            {' · '}
                                            subscription {tenant.subscription.status.toLowerCase()}
                                        </div>
                                    </>
                                ) : (
                                    <span className="portal-text-body text-ink-500">
                                        No subscription — running as &ldquo;{tenant.plan_tier}&rdquo;
                                    </span>
                                )}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-ink-300 p-4">
                        <p className="portal-text-body text-ink-600">
                            Not linked to a customer account — only the email{' '}
                            <span className="font-medium text-ink-900">{tenant.customer_email}</span> is on record,
                            so this store has no plan and no billing behind it.
                        </p>
                        <Link
                            href={`/admin/users?email=${encodeURIComponent(tenant.customer_email)}`}
                            className="mt-2 inline-block portal-text-body font-semibold text-link hover:underline"
                        >
                            Find this customer →
                        </Link>
                    </div>
                )}
            </section>

            {/* --- lifecycle --- */}
            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="font-bold text-ink-900">Lifecycle</h2>
                <p className="mt-1 portal-text-caption text-ink-400">
                    Provision, redeploy and migrate are queued and run in the background.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                    <form action={tenantLifecycleAction}>
                        <input type="hidden" name="id" value={tenant.id} />
                        <input type="hidden" name="action" value="provision" />
                        <Button type="submit" size="sm" className="gap-1.5">
                            <Play className="h-3.5 w-3.5" />{neverProvisioned ? 'Provision' : 'Re-provision'}
                        </Button>
                    </form>

                    {!neverProvisioned && (
                        <>
                            <form action={tenantLifecycleAction}>
                                <input type="hidden" name="id" value={tenant.id} />
                                <input type="hidden" name="action" value="redeploy" />
                                <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                                    <RefreshCw className="h-3.5 w-3.5" />Redeploy
                                </Button>
                            </form>

                            <form action={tenantLifecycleAction}>
                                <input type="hidden" name="id" value={tenant.id} />
                                <input type="hidden" name="action" value={isRunning ? 'stop' : 'start'} />
                                <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                                    {isRunning ? <><Square className="h-3.5 w-3.5" />Stop</> : <><Play className="h-3.5 w-3.5" />Start</>}
                                </Button>
                            </form>

                            <form action={tenantLifecycleAction}>
                                <input type="hidden" name="id" value={tenant.id} />
                                <input type="hidden" name="action" value="db-migrate" />
                                <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                                    <Database className="h-3.5 w-3.5" />Run DB migrations
                                </Button>
                            </form>
                        </>
                    )}

                    <form action={tenantLifecycleAction}>
                        <input type="hidden" name="id" value={tenant.id} />
                        <input type="hidden" name="action" value="backup" />
                        <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                            <HardDriveDownload className="h-3.5 w-3.5" />Back up now
                        </Button>
                    </form>
                </div>
            </section>

            {/* --- domains --- */}
            <section className="mt-8 overflow-hidden portal-surface">
                <div className="flex items-center gap-3 border-b border-ink-100 p-5 sm:p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand">
                        <Globe className="h-4 w-4" />
                    </span>
                    <div>
                        <h2 className="font-bold text-ink-900">Domains</h2>
                        <p className="portal-text-caption text-ink-400">Custom domains need a DNS record pointing at the proxy before they verify.</p>
                    </div>
                </div>

                {domains.length === 0 ? (
                    <p className="flex min-h-20 items-center justify-center p-6 portal-text-body text-ink-400">No domains yet.</p>
                ) : (
                    <div>
                        {domains.map((domain) => (
                            <div key={domain.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4 last:border-0">
                                <div className="min-w-0">
                                    <p className="truncate font-mono portal-text-body text-ink-900">{domain.domain}</p>
                                    <p className="mt-0.5 portal-text-caption text-ink-400">
                                        {domain.domain_type}
                                        {domain.ssl_status ? ` · SSL ${domain.ssl_status}` : ''}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Badge variant={DOMAIN_STATUS_BADGE[domain.status] ?? 'neutral'}>{domain.status}</Badge>
                                    {domain.status !== 'active' && (
                                        <form action={domainAction}>
                                            <input type="hidden" name="domain_id" value={domain.id} />
                                            <input type="hidden" name="tenant_id" value={tenant.id} />
                                            <input type="hidden" name="action" value={domain.domain_type === 'custom' ? 'verify' : 'activate'} />
                                            <Button type="submit" size="sm" variant="outline" >
                                                {domain.domain_type === 'custom' ? 'Verify DNS' : 'Activate'}
                                            </Button>
                                        </form>
                                    )}
                                    {domain.status === 'active' && (
                                        <form action={domainAction}>
                                            <input type="hidden" name="domain_id" value={domain.id} />
                                            <input type="hidden" name="tenant_id" value={tenant.id} />
                                            <input type="hidden" name="action" value="disable" />
                                            <Button type="submit" size="sm" variant="outline" >Disable</Button>
                                        </form>
                                    )}
                                    <form action={domainAction}>
                                        <input type="hidden" name="domain_id" value={domain.id} />
                                        <input type="hidden" name="tenant_id" value={tenant.id} />
                                        <input type="hidden" name="action" value="remove" />
                                        <Button type="submit" size="sm" variant="outline" className="text-ink-500 hover:bg-error-50 hover:text-error-700">
                                            Remove
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-t border-ink-100 bg-ink-50/50 p-5 sm:p-6">
                    <TenantDomainForm tenantId={tenant.id} />
                </div>
            </section>

            {/* --- backups --- */}
            <section className="mt-8 overflow-hidden portal-surface">
                <div className="border-b border-ink-100 p-5 sm:p-6">
                    <h2 className="font-bold text-ink-900">Backups</h2>
                    <p className="portal-text-caption text-ink-400">pg_dump snapshots of the tenant database.</p>
                </div>
                {backups.length === 0 ? (
                    <p className="flex min-h-20 items-center justify-center p-6 portal-text-body text-ink-400">No backups yet.</p>
                ) : (
                    <div>
                        {backups.slice(0, 10).map((backup) => (
                            <div key={backup.id} className="flex items-center justify-between gap-4 border-b border-ink-100 px-6 py-4 last:border-0">
                                <div className="min-w-0">
                                    <p className="portal-text-body text-ink-800">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.created_at))}
                                    </p>
                                    <p className="mt-0.5 portal-text-caption text-ink-400">
                                        {backup.reason ?? 'manual'}
                                        {backup.size_bytes ? ` · ${(backup.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}
                                        {backup.error_message ? ` · ${backup.error_message}` : ''}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Badge variant={backup.status === 'success' ? 'success' : backup.status === 'failed' ? 'error' : 'warning'}>
                                        {backup.status}
                                    </Badge>
                                    {backup.status === 'success' && (
                                        <form action={restoreBackupAction}>
                                            <input type="hidden" name="tenant_id" value={tenant.id} />
                                            <input type="hidden" name="backup_id" value={backup.id} />
                                            <Button type="submit" size="sm" variant="outline" >Restore</Button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* --- resize / migrate --- */}
            <div className="mt-8 grid gap-6 md:grid-cols-2">
                <section className="p-5 sm:p-6 portal-surface">
                    <h2 className="mb-4 font-bold text-ink-900">Resize</h2>
                    <TenantResizeForm
                        tenantId={tenant.id}
                        memory={String(tenant.memory_limit_mb)}
                        cpu={String(tenant.cpu_limit_cores)}
                    />
                </section>

                <section className="p-5 sm:p-6 portal-surface">
                    <h2 className="mb-1 font-bold text-ink-900">Move to another database cluster</h2>
                    <p className="mb-4 portal-text-caption text-ink-400">
                        Currently on <strong>{tenant.database_cluster ?? 'the default cluster'}</strong>. This dumps and
                        restores the whole database, then redeploys — the source is only dropped once the move succeeds.
                    </p>
                    <TenantDatabaseMigrateForm
                        tenantId={tenant.id}
                        currentClusterId={tenant.database_connection_id}
                        clusters={clusters.map((c) => ({ id: c.id, name: c.name, isDefault: c.is_default }))}
                    />
                </section>

                <section className="p-5 sm:p-6 portal-surface">
                    <h2 className="mb-1 font-bold text-ink-900">Migrate to another node</h2>
                    <p className="mb-4 portal-text-caption text-ink-400">
                        Blue/green: the new container is deployed and health-checked before the old one is torn down.
                    </p>
                    <TenantMigrateForm
                        tenantId={tenant.id}
                        servers={servers
                            .filter((s) => s.role === 'worker' && s.is_active && s.id !== tenant.node_id)
                            .map((s) => ({ id: s.id, name: s.name }))}
                    />
                </section>
            </div>

            <section className="mt-8 rounded-xl border border-error-500/20 bg-error-50/40 p-5 sm:p-6">
                <h2 className="font-bold text-ink-900">Danger zone</h2>
                <p className="mt-1 mb-4 portal-text-body text-ink-600">
                    Deleting a tenant tears down its container and removes its record. The API refuses while a
                    container is still live unless it is stopped first.
                </p>
                <DeleteButton
                    action={deleteTenantAction}
                    id={tenant.id}
                    title="Delete this tenant?"
                    description={`"${tenant.tenant_slug}" and its deployment records will be permanently deleted.`}
                />
            </section>
        </div>
    );
}
