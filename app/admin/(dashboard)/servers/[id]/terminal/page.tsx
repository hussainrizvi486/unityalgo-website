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
        <div className="max-w-5xl">
            <Link
                href={`/admin/servers/${server.id}`}
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
            >
                <ArrowLeft className="h-4 w-4" />Back to {server.name}
            </Link>

            <h1 className="text-2xl font-bold">Terminal — {server.name}</h1>
            <p className="mt-1 mb-6 font-mono text-sm text-ink-500">
                {server.ssh_user}@{server.ip_address}:{server.ssh_port}
            </p>

            <TerminalClient serverId={server.id} serverName={server.name} />
        </div>
    );
}
