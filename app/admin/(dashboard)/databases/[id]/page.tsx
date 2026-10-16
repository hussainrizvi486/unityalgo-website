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
            <Link href="/admin/databases" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to databases
            </Link>

            <div className="flex items-start justify-between gap-gap">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{db.name}</h1>
                        <Badge variant={db.role === 'cluster' ? 'info' : 'neutral'}>{db.role}</Badge>
                        {db.is_default && <Badge variant="brand">Default</Badge>}
                    </div>
                    <p className="mt-1 font-mono portal-text-body text-muted-foreground">
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

            {error && <div className="mt-6 rounded-md bg-destructive/10 px-3.5 py-2.5 portal-text-body text-destructive">{error}</div>}
            {done && (
                <div className="mt-6 flex items-center gap-2 rounded-md bg-success/10 px-3.5 py-2.5 portal-text-body text-success">
                    <CheckCircle2 className="h-4 w-4" />Saved.
                </div>
            )}

            {db.last_test_status && (
                <div className="mt-6 rounded-xl border border-border/60 bg-card p-4 portal-text-body">
                    <span className="text-muted-foreground">Last test:</span>{' '}
                    <Badge variant={db.last_test_status === 'success' ? 'success' : 'error'}>{db.last_test_status}</Badge>
                    {db.last_test_message && <p className="mt-2 font-mono portal-text-caption text-foreground/70">{db.last_test_message}</p>}
                </div>
            )}

            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="mb-6 text-foreground">Settings</h2>
                <DatabaseForm
                    action={updateDatabaseAction.bind(null, db.id)}
                    submitLabel="Save changes"
                    isEdit
                    defaultValues={{
                        engine: db.engine,
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

            <section className="mt-8 rounded-xl border border-destructive/20 bg-destructive/20 p-card sm:p-6">
                <h2 className=" text-foreground">Danger zone</h2>
                <p className="mt-1 mb-4 portal-text-body text-foreground/70">
                    Deregistering removes the record here; the database itself is untouched. Refused while any tenant
                    still has its data on this cluster.
                </p>
                <DeleteButton
                    action={deleteDatabaseAction}
                    id={db.id}
                    title="Deregister this database?"
                    description={`"${db.name}" will be removed from the platform. The ${db.engine === 'mariadb' ? 'MariaDB' : 'PostgreSQL'} server itself is left untouched.`}
                />
            </section>
        </div>
    );
}
