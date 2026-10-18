import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft, CheckCircle2, Cpu, Globe, HardDrive, MemoryStick, Network, ShieldCheck, TerminalSquare,
} from 'lucide-react';
import { controller, ControllerError, type ControllerServer } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { deleteServerAction, serverMaintenanceAction, updateServerAction } from '@/app/admin/controller-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/admin/delete-button';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { ServerForm } from '../server-form';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string }>;
}

const ACTION_LABELS: Record<string, string> = {
    check: 'SSH reachability check passed.',
    connect: 'Connected — hardware and Docker specs refreshed.',
    bootstrap: 'Docker bootstrap started.',
    'bootstrap-caddy': 'Caddy edge proxy bootstrap started.',
    lockdown: 'Firewall lockdown applied.',
};

function Spec({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="flex items-center gap-2 portal-text-caption text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
            <p className="mt-1.5 portal-text-body font-semibold text-foreground">{value}</p>
        </div>
    );
}

export default async function ServerDetailPage({ params, searchParams }: PageProps) {
    await requireAdmin();
    const { id } = await params;
    const { error, done } = await searchParams;

    let server: ControllerServer;
    try {
        server = await controller.servers.get(id);
    } catch (err) {
        if (err instanceof ControllerError) {
            if (err.status === 404) notFound();
            return <ControllerOffline message={err.message} />;
        }
        throw err;
    }

    const isProxy = server.role === 'proxy';

    return (
        <div className="portal-detail">
            <Link href="/admin/servers" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to servers
            </Link>

            <div className="flex items-start justify-between gap-gap">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{server.name}</h1>
                        <Badge variant={isProxy ? 'info' : 'neutral'}>{server.role}</Badge>
                        <Badge variant={server.is_active ? 'success' : 'neutral'}>
                            {server.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                    </div>
                    <p className="mt-1 font-mono portal-text-body text-muted-foreground">
                        {server.ssh_user}@{server.ip_address}:{server.ssh_port}
                    </p>
                </div>
                <Button asChild variant="outline" className="gap-2"><Link href={`/admin/servers/${server.id}/terminal`}>
                        <TerminalSquare className="h-4 w-4" />Open terminal
                    </Link></Button>
            </div>

            {error && <div className="mt-6 rounded-md bg-destructive/10 px-3.5 py-2.5 portal-text-body text-destructive">{error}</div>}
            {done && (
                <div className="mt-6 flex items-center gap-2 rounded-md bg-success/10 px-3.5 py-2.5 portal-text-body text-success">
                    <CheckCircle2 className="h-4 w-4" />{ACTION_LABELS[done] ?? 'Done.'}
                </div>
            )}

            {/* --- specs --- */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Spec icon={Cpu} label="CPU cores" value={server.cpu_cores ? String(server.cpu_cores) : '—'} />
                <Spec
                    icon={MemoryStick}
                    label="Memory"
                    value={server.max_memory_mb ? `${(server.used_memory_mb / 1024).toFixed(1)} / ${(server.max_memory_mb / 1024).toFixed(1)} GB` : '—'}
                />
                <Spec
                    icon={HardDrive}
                    label="Disk"
                    value={server.disk_total_gb ? `${server.disk_used_gb ?? 0} / ${server.disk_total_gb} GB` : '—'}
                />
                <Spec icon={Network} label="Containers" value={`${server.active_containers ?? 0}${server.max_containers ? ` / ${server.max_containers}` : ''}`} />
                {server.frappe_enabled && <Spec icon={Globe} label="Max sites" value={server.max_sites != null ? String(server.max_sites) : 'No limit'} />}
            </div>

            <div className="mt-3 rounded-xl border border-border/60 bg-card p-4 portal-text-body text-foreground/70">
                <span className="text-muted-foreground">OS:</span> {server.os_name ?? 'not collected'}
                {server.kernel_version ? <> · <span className="text-muted-foreground">kernel</span> {server.kernel_version}</> : null}
                {server.architecture ? <> · <span className="text-muted-foreground">arch</span> {server.architecture}</> : null}
                {server.docker_version ? <> · <span className="text-muted-foreground">Docker</span> {server.docker_version}</> : null}
                {server.last_checked_at ? (
                    <div className="mt-1 portal-text-caption text-muted-foreground">
                        Last checked {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(server.last_checked_at))}
                        {server.last_check_status ? ` — ${server.last_check_status}` : ''}
                    </div>
                ) : null}
            </div>

            {/* --- maintenance --- */}
            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className=" text-foreground">Maintenance</h2>
                <p className="mt-1 portal-text-caption text-muted-foreground">
                    These run over SSH against the live node. Bootstrap operations are queued and continue in the
                    background — follow them in the <Link href="/admin/logs" className="text-primary hover:underline">activity log</Link>.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                    {[
                        { action: 'check', label: 'Check SSH', variant: 'outline' as const },
                        { action: 'connect', label: 'Connect & refresh specs', variant: 'outline' as const },
                        { action: 'bootstrap', label: 'Bootstrap Docker', variant: 'outline' as const },
                    ].map(({ action, label, variant }) => (
                        <form key={action} action={serverMaintenanceAction}>
                            <input type="hidden" name="id" value={server.id} />
                            <input type="hidden" name="action" value={action} />
                            <Button type="submit" size="sm" variant={variant} >{label}</Button>
                        </form>
                    ))}

                    {}
                    {isProxy ? (
                        <form action={serverMaintenanceAction}>
                            <input type="hidden" name="id" value={server.id} />
                            <input type="hidden" name="action" value="bootstrap-caddy" />
                            <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />Bootstrap Caddy
                            </Button>
                        </form>
                    ) : (
                        <form action={serverMaintenanceAction}>
                            <input type="hidden" name="id" value={server.id} />
                            <input type="hidden" name="action" value="lockdown" />
                            <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" />Apply firewall lockdown
                            </Button>
                        </form>
                    )}
                </div>
            </section>

            {/* --- edit --- */}
            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="mb-6 text-foreground">Settings</h2>
                <ServerForm
                    action={updateServerAction.bind(null, server.id)}
                    submitLabel="Save changes"
                    isEdit
                    defaultValues={{
                        name: server.name,
                        ip_address: server.ip_address,
                        private_ip: server.private_ip ?? '',
                        role: server.role,
                        ssh_port: String(server.ssh_port),
                        ssh_user: server.ssh_user ?? '',
                        max_memory_mb: server.max_memory_mb ? String(server.max_memory_mb) : '',
                        max_containers: server.max_containers ? String(server.max_containers) : '',
                        max_sites: server.max_sites != null ? String(server.max_sites) : '',
                        is_active: server.is_active,
                        frappe_enabled: server.frappe_enabled,
                    }}
                />
            </section>

            <section className="mt-8 rounded-xl border border-destructive/20 bg-destructive/20 p-card sm:p-6">
                <h2 className=" text-foreground">Danger zone</h2>
                <p className="mt-1 mb-4 portal-text-body text-foreground/70">
                    Deregistering only removes the record here — it does not touch the machine. The API refuses if
                    tenants are still deployed on it.
                </p>
                <DeleteButton
                    action={deleteServerAction}
                    id={server.id}
                    title="Deregister this node?"
                    description={`"${server.name}" will be removed from the fleet. The machine itself is left untouched.`}
                />
            </section>
        </div>
    );
}
