import Link from 'next/link';
import { Activity, Database, Radio, Workflow } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { formatDateTime } from '@/lib/admin-format';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';

export const metadata = { title: 'Queue & workers' };

const ago = (seconds: number | null) => {
    if (seconds == null) return 'never';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`;
};
const uptime = (seconds: number | null) => (seconds == null ? '—' : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : seconds < 172800 ? `${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 86400)} days`);

function Card({ icon, title, ok, status, children }: { icon: React.ReactNode; title: string; ok: boolean; status: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border p-card">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2">{icon}{title}</h2>
                <Badge variant={ok ? 'success' : 'error'}>{status}</Badge>
            </div>
            <div className="mt-3 space-y-1 portal-text-body text-muted-foreground">{children}</div>
        </section>
    );
}

export default async function AdminQueuePage() {
    await requireAdmin();
    let status;
    try {
        status = await controller.sites.adminSystem();
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }
    const waiting = status.queues.reduce((sum, queue) => sum + (queue.waiting ?? 0), 0);
    const workersUp = status.workers.length > 0;
    const stuck = status.sites.filter((site) => site.stuck);
    const running = status.workers.reduce((sum, worker) => sum + worker.running.length, 0);

    return (
        <div>
            <AutoRefresh active seconds={5} />
            <AdminPageHeader title="Queue & workers" subtitle={`Refreshes every 5 seconds · checked ${formatDateTime(status.checked_at)}`} />

            {!status.redis.ok && <Notice tone="error" className="mb-6">Redis is not reachable, so nothing can be queued or processed. {status.redis.error}</Notice>}
            {status.redis.ok && !workersUp && (
                <Notice tone="error" className="mb-6">
                    No worker is running. Site creation, deletes, backups and app installs wait in the queue ({waiting} waiting) until one starts.
                    Start it with <code>scripts/dev.sh</code>, or <code>python main.py worker</code> in the controller folder.
                </Notice>
            )}
            {status.redis.ok && workersUp && !status.beat.alive && (
                <Notice tone="warning" className="mb-6">
                    The scheduler is not running, so metrics, trial expiry, health checks and scheduled backups are not triggered.
                    Start it with <code>python main.py beat</code> in the controller folder.
                </Notice>
            )}
            {stuck.length > 0 && (
                <Notice tone="warning" className="mb-6">
                    {stuck.length} site{stuck.length === 1 ? ' looks' : 's look'} stuck: {stuck.map((site) => site.slug).join(', ')}.
                </Notice>
            )}

            <div className="grid gap-gap md:grid-cols-2 xl:grid-cols-4">
                <Card icon={<Database className="size-4 text-muted-foreground" />} title="Redis" ok={status.redis.ok} status={status.redis.ok ? 'Connected' : 'Down'}>
                    {status.redis.ok ? (
                        <>
                            <p>Latency {status.redis.latency_ms} ms</p>
                            <p>Version {status.redis.version} · {status.redis.memory} used</p>
                            <p>{status.redis.clients} clients · up {uptime(status.redis.uptime_seconds)}</p>
                        </>
                    ) : <p>{status.redis.error}</p>}
                </Card>
                <Card icon={<Workflow className="size-4 text-muted-foreground" />} title="Workers" ok={workersUp} status={workersUp ? `${status.workers.length} running` : 'None running'}>
                    <p>{running} task{running === 1 ? '' : 's'} running now</p>
                    <p>{status.workers.reduce((sum, worker) => sum + (worker.concurrency ?? 0), 0)} slots in total</p>
                    {status.worker_error && <p className="text-destructive">{status.worker_error}</p>}
                </Card>
                <Card icon={<Radio className="size-4 text-muted-foreground" />} title="Scheduler (beat)" ok={status.beat.alive} status={status.beat.alive ? 'Running' : 'Not running'}>
                    <p>Last tick {ago(status.beat.last_seen_seconds)}</p>
                    <p>Ticks every {status.beat.interval_seconds}s</p>
                </Card>
                <Card icon={<Activity className="size-4 text-muted-foreground" />} title="Queue" ok={waiting === 0 || workersUp} status={waiting === 0 ? 'Empty' : `${waiting} waiting`}>
                    {status.queues.map((queue) => <p key={queue.name}>{queue.name}: {queue.waiting ?? '—'} waiting</p>)}
                </Card>
            </div>

            <section className="mt-4 rounded-xl border border-border p-card">
                <h2>Workers ({status.workers.length})</h2>
                {status.workers.length === 0 ? (
                    <p className="mt-3 portal-text-body text-muted-foreground">No worker answered.</p>
                ) : (
                    <ul className="mt-2 divide-y divide-border/60">
                        {status.workers.map((worker) => (
                            <li key={worker.name} className="py-3">
                                <div className="flex flex-wrap items-center justify-between gap-gap">
                                    <span className="font-medium">{worker.name}</span>
                                    <span className="portal-text-caption text-muted-foreground">
                                        pid {worker.pid ?? '—'} · {worker.processes}/{worker.concurrency ?? '—'} processes · {worker.processed} done · {worker.reserved} reserved
                                    </span>
                                </div>
                                {worker.running.length ? (
                                    <ul className="mt-2 space-y-1 portal-text-caption">
                                        {worker.running.map((task) => (
                                            <li key={task.id} className="flex flex-wrap justify-between gap-gap rounded-md bg-muted px-3 py-1.5">
                                                <span className="font-mono">{task.name}</span>
                                                <span className="text-muted-foreground">{task.started_at ? ago(Math.max(0, Math.round(Date.now() / 1000 - task.started_at))) : ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="mt-1 portal-text-caption text-muted-foreground">Idle</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mt-4 rounded-xl border border-border p-card">
                <h2>Sites in progress ({status.sites.length})</h2>
                {status.sites.length === 0 ? (
                    <p className="mt-3 portal-text-body text-muted-foreground">Nothing is being created, deleted or changed.</p>
                ) : (
                    <ul className="mt-2 divide-y divide-border/60">
                        {status.sites.map((site) => (
                            <li key={site.id} className="flex flex-wrap items-center justify-between gap-gap py-3">
                                <span>
                                    <Link href={`/admin/sites/${site.id}`} className="font-medium hover:text-primary hover:underline">{site.slug}</Link>
                                    <span className="block portal-text-caption text-muted-foreground">{site.message}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="portal-text-caption text-muted-foreground">{ago(site.age_seconds)}</span>
                                    <Badge variant={site.stuck ? 'warning' : 'info'}>{site.status.replaceAll('_', ' ')}{site.stuck ? ' · stuck?' : ''}</Badge>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
