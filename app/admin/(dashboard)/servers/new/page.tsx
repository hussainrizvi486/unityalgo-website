import { requireAdmin } from '@/lib/admin-session';
import { createServerAction } from '@/app/admin/controller-actions';
import { ServerForm } from '../server-form';

export default async function NewServerPage() {
    await requireAdmin();

    return (
        <div>
            <h1 className="portal-page-title mb-2">Register Node</h1>
            <p className="portal-text-body text-muted-foreground mb-8 portal-form">
                Registering a node only records it. Use <strong>Connect</strong> on the node page afterwards to probe
                it over SSH and collect its specs, then <strong>Bootstrap</strong> to install Docker.
            </p>
            <ServerForm action={createServerAction} submitLabel="Register Node" />
        </div>
    );
}
