import Link from 'next/link';
import {
    controller, ControllerError,
    type ControllerActivityLog, type ControllerOperation,
} from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { Button } from '@/components/ui/button';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader } from '@/components/admin/page-header';
import { OPERATION_STATUS_BADGE, humanizeStatus } from '@/lib/controller-status';
import { formatDateTime } from '@/lib/admin-format';
import { LogsList, type LogRow } from './logs-list';

interface PageProps {
    searchParams: Promise<{ view?: string }>;
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
    await requireAdmin();
    const params = await searchParams;
    const view = params.view === 'events' ? 'events' : 'operations';

    let operations: ControllerOperation[] = [];
    let events: ControllerActivityLog[] = [];

    try {
        if (view === 'operations') {
            operations = (await controller.logs.operations({})).results ?? [];
        } else {
            events = (await controller.logs.list({})).results ?? [];
        }
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    const rows: LogRow[] =
        view === 'operations'
            ? operations.map((operation) => ({
                  id: operation.id,
                  href: `/admin/logs/${operation.id}`,
                  title: operation.label,
                  subtitle:
                      operation.step_count != null
                          ? `${operation.category} · ${operation.step_count} steps`
                          : operation.category,
                  target: operation.tenant_slug ?? operation.server_name ?? '—',
                  actor: operation.actor ?? 'system',
                  started: formatDateTime(operation.started_at),
                  category: operation.category,
                  statusLabel: humanizeStatus(operation.status),
                  statusVariant: OPERATION_STATUS_BADGE[operation.status] ?? 'neutral',
              }))
            : events.map((event) => ({
                  id: event.id,
                  href: event.operation_id ? `/admin/logs/${event.operation_id}` : undefined,
                  title: event.action,
                  subtitle: `${event.category} · ${formatDateTime(event.created_at)}`,
                  target: event.tenant_slug ?? event.server_name ?? '—',
                  message: event.message ?? '—',
                  category: event.category,
                  statusLabel: humanizeStatus(event.status),
                  statusVariant: OPERATION_STATUS_BADGE[event.status] ?? 'neutral',
              }));

    // Only offer categories actually present, so no filter can come back empty.
    const categories = [...new Set(rows.map((row) => row.category))].sort();

    return (
        <div>
            <AdminPageHeader
                title="Activity log"
                subtitle="Every infrastructure operation the controller has run, and the individual steps within each."
            />

            {/* Operations are grouped end-to-end processes; events are the
                individual steps, including standalone ones like health sweeps. */}
            <div className="mb-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant={view === 'operations' ? 'default' : 'outline'} ><Link href="/admin/logs">
                        Operations
                    </Link></Button>
                <Button asChild size="sm" variant={view === 'events' ? 'default' : 'outline'} ><Link href="/admin/logs?view=events">
                        All events
                    </Link></Button>
            </div>

            <LogsList view={view} rows={rows} categories={categories} />
        </div>
    );
}
