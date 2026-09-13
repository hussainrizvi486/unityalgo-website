import { requireAdmin } from '@/lib/admin-session';
import { createServerAction } from '@/app/admin/controller-actions';
import { ServerForm } from '../server-form';

export default async function NewServerPage() {
    await requireAdmin();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">Register Node</h1>
            <p className="text-sm text-ink-500 mb-8 max-w-2xl">
                Registering a node only records it. Use <strong>Connect</strong> on the node page afterwards to probe
                it over SSH and collect its specs, then <strong>Bootstrap</strong> to install Docker.
            </p>
            <ServerForm action={createServerAction} submitLabel="Register Node" />
        </div>
    );
}
