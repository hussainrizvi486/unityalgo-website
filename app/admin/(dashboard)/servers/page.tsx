import { controller, ControllerError, type ControllerServer } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { ServersList, type ServerRow } from './servers-list';

interface ServersPageProps {
    searchParams: Promise<{ error?: string }>;
}

function memoryLabel(server: ControllerServer) {
    if (!server.max_memory_mb) return '—';
    const used = server.used_memory_mb ?? 0;
    return `${(used / 1024).toFixed(1)} / ${(server.max_memory_mb / 1024).toFixed(1)} GB`;
}

export default async function AdminServersPage({ searchParams }: ServersPageProps) {
    await requireAdmin();
    const params = await searchParams;

    let servers: ControllerServer[];
    try {
        servers = (await controller.servers.list()).results ?? [];
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    const rows: ServerRow[] = servers.map((server) => ({
        id: server.id,
        name: server.name,
        specs:
            (server.specs.os_name ?? 'specs not collected')
            + (server.specs.docker_version ? ` · Docker ${server.specs.docker_version}` : ''),
        ipAddress: server.ip_address,
        privateIp: server.private_ip,
        role: server.role,
        memory: memoryLabel(server),
        containers:
            `${server.active_containers ?? 0}`
            + (server.max_containers ? ` / ${server.max_containers}` : ''),
        isActive: server.is_active,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Servers"
                subtitle={`${rows.length} node${rows.length === 1 ? '' : 's'} in the fleet`}
                action={{ label: 'Register Node', href: '/admin/servers/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            <ServersList rows={rows} />
        </div>
    );
}
