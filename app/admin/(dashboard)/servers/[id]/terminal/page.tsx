import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { controller, ControllerError, type ControllerServer } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { TerminalClient } from './terminal-client';

export default async function ServerTerminalPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;

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

    return (
        <div className="max-w-wide">
            <Link
                href={`/admin/servers/${server.id}`}
                className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80"
            >
                <ArrowLeft className="h-4 w-4" />Back to {server.name}
            </Link>

            <h1 className="portal-page-title">Terminal — {server.name}</h1>
            <p className="mt-1 mb-6 font-mono portal-text-body text-muted-foreground">
                {server.ssh_user}@{server.ip_address}:{server.ssh_port}
            </p>

            <TerminalClient serverId={server.id} serverName={server.name} />
        </div>
    );
}
