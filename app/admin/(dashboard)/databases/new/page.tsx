import { requireAdmin } from '@/lib/admin-session';
import { createDatabaseAction } from '@/app/admin/controller-actions';
import { DatabaseForm } from '../database-form';

export default async function NewDatabasePage() {
    await requireAdmin();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">Register Database</h1>
            <p className="text-sm text-ink-500 mb-8 max-w-2xl">
                A <strong>cluster</strong> is a PostgreSQL instance you hold admin credentials for, so tenant databases
                can be created on it and moved between clusters. An <strong>external</strong> connection is read-only
                from the platform&apos;s point of view — usable from the query console, but never provisioned onto.
            </p>
            <DatabaseForm action={createDatabaseAction} submitLabel="Register Database" />
        </div>
    );
}
