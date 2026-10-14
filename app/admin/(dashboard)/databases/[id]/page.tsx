import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Database } from 'lucide-react';
import { controller, ControllerError, type ControllerDatabase } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { deleteDatabaseAction, testDatabaseAction, updateDatabaseAction } from '@/app/admin/controller-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/admin/delete-button';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { DatabaseForm } from '../database-form';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; done?: string }>;
}

export default async function DatabaseDetailPage({ params, searchParams }: PageProps) {
    await requireAdmin();
    const { id } = await params;
    const { error, done } = await searchParams;

    let db: ControllerDatabase;
    try {
        db = await controller.databases.get(id);
    } catch (err) {
        if (err instanceof ControllerError) {
            if (err.status === 404) notFound();
            return <ControllerOffline message={err.message} />;
        }
        throw err;
    }

    return (
        <div className="portal-detail">
            <Link href="/admin/databases" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-ink-500 hover:text-ink-700">
                <ArrowLeft className="h-4 w-4" />Back to databases
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{db.name}</h1>
                        <Badge variant={db.role === 'cluster' ? 'info' : 'neutral'}>{db.role}</Badge>
                        {db.is_default && <Badge variant="brand">Default</Badge>}
                    </div>
                    <p className="mt-1 font-mono portal-text-body text-ink-500">
                        {db.username}@{db.host}:{db.port}/{db.database_name}
                    </p>
                </div>
                <form action={testDatabaseAction}>
                    <input type="hidden" name="id" value={db.id} />
                    <Button type="submit" variant="outline" className="gap-2">
                        <Database className="h-4 w-4" />Test connection
                    </Button>
                </form>
            </div>

            {error && <div className="mt-6 rounded-md bg-error-50 px-3.5 py-2.5 portal-text-body text-error-700">{error}</div>}
            {done && (
                <div className="mt-6 flex items-center gap-2 rounded-md bg-success-50 px-3.5 py-2.5 portal-text-body text-success-700">
                    <CheckCircle2 className="h-4 w-4" />Saved.
                </div>
            )}

            {db.last_test_status && (
                <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 portal-text-body">
                    <span className="text-ink-400">Last test:</span>{' '}
                    <Badge variant={db.last_test_status === 'success' ? 'success' : 'error'}>{db.last_test_status}</Badge>
                    {db.last_test_message && <p className="mt-2 font-mono portal-text-caption text-ink-600">{db.last_test_message}</p>}
                </div>
            )}

            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="mb-6 font-bold text-ink-900">Settings</h2>
                <DatabaseForm
                    action={updateDatabaseAction.bind(null, db.id)}
                    submitLabel="Save changes"
                    isEdit
                    defaultValues={{
                        name: db.name,
                        host: db.host,
                        port: String(db.port),
                        database_name: db.database_name,
                        username: db.username,
                        sslmode: db.sslmode,
                        role: db.role,
                        host_from_worker: db.host_from_worker ?? '',
                        is_default: db.is_default,
                        allow_writes: db.allow_writes,
                        notes: db.notes ?? '',
                    }}
                />
            </section>

            <section className="mt-8 rounded-xl border border-error-500/20 bg-error-50/40 p-5 sm:p-6">
                <h2 className="font-bold text-ink-900">Danger zone</h2>
                <p className="mt-1 mb-4 portal-text-body text-ink-600">
                    Deregistering removes the record here; the database itself is untouched. Refused while any tenant
                    still has its data on this cluster.
                </p>
                <DeleteButton
                    action={deleteDatabaseAction}
                    id={db.id}
                    title="Deregister this database?"
                    description={`"${db.name}" will be removed from the platform. The PostgreSQL instance itself is left untouched.`}
                />
            </section>
        </div>
    );
}
