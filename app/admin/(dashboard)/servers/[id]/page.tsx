import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft, CheckCircle2, Cpu, HardDrive, MemoryStick, Network, ShieldCheck, TerminalSquare,
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
        <div className="rounded-xl border border-ink-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs text-ink-400"><Icon className="h-3.5 w-3.5" />{label}</p>
            <p className="mt-1.5 text-sm font-semibold text-ink-900">{value}</p>
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
        <div className="max-w-4xl">
            <Link href="/admin/servers" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
                <ArrowLeft className="h-4 w-4" />Back to servers
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{server.name}</h1>
                        <Badge variant={isProxy ? 'info' : 'neutral'}>{server.role}</Badge>
                        <Badge variant={server.is_active ? 'success' : 'neutral'}>
                            {server.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                    </div>
                    <p className="mt-1 font-mono text-sm text-ink-500">
                        {server.ssh_user}@{server.ip_address}:{server.ssh_port}
                    </p>
                </div>
                <Link href={`/admin/servers/${server.id}/terminal`}>
                    <Button variant="outline" className="gap-2">
                        <TerminalSquare className="h-4 w-4" />Open terminal
                    </Button>
                </Link>
            </div>

            {error && <div className="mt-6 rounded-md bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}
            {done && (
                <div className="mt-6 flex items-center gap-2 rounded-md bg-success-50 px-3.5 py-2.5 text-sm text-success-700">
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
            </div>

            <div className="mt-3 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-600">
                <span className="text-ink-400">OS:</span> {server.os_name ?? 'not collected'}
                {server.kernel_version ? <> · <span className="text-ink-400">kernel</span> {server.kernel_version}</> : null}
                {server.architecture ? <> · <span className="text-ink-400">arch</span> {server.architecture}</> : null}
                {server.docker_version ? <> · <span className="text-ink-400">Docker</span> {server.docker_version}</> : null}
                {server.last_checked_at ? (
                    <div className="mt-1 text-xs text-ink-400">
                        Last checked {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(server.last_checked_at))}
                        {server.last_check_status ? ` — ${server.last_check_status}` : ''}
                    </div>
                ) : null}
            </div>

            {/* --- maintenance --- */}
            <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 sm:p-6">
                <h2 className="font-bold text-ink-900">Maintenance</h2>
                <p className="mt-1 text-xs text-ink-400">
                    These run over SSH against the live node. Bootstrap operations are queued and continue in the
                    background — follow them in the <Link href="/admin/logs" className="text-link hover:underline">activity log</Link>.
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

                    {/* Role-specific: the API rejects these against the wrong role, so
                        only offer the one that applies. */}
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
            <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 sm:p-6">
                <h2 className="mb-6 font-bold text-ink-900">Settings</h2>
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
                        is_active: server.is_active,
                        frappe_enabled: server.frappe_enabled,
                    }}
                />
            </section>

            <section className="mt-8 rounded-xl border border-error-500/20 bg-error-50/40 p-5 sm:p-6">
                <h2 className="font-bold text-ink-900">Danger zone</h2>
                <p className="mt-1 mb-4 text-sm text-ink-600">
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
