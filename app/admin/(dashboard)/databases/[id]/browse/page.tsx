import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { controller, ControllerError, type DbSchema, type ControllerDatabase } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { runDatabaseQueryAction } from '@/app/admin/controller-actions';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageError } from '@/components/admin/page-header';
import { DatabaseBrowser } from './database-browser';

export default async function DatabaseBrowsePage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;

    let connection: ControllerDatabase;
    let schema: DbSchema | null = null;
    let schemaError: string | null = null;

    try {
        connection = await controller.databases.get(id);
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    try {
        schema = await controller.databases.schema(id);
    } catch (error) {
        schemaError = error instanceof ControllerError ? error.message : 'Could not read the schema.';
    }

    return (
        <div>
            <Link
                href={`/admin/databases/${id}`}
                className="mb-4 inline-flex items-center gap-1.5 portal-text-body text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to {connection.name}
            </Link>

            {schemaError ? <AdminPageError message={schemaError} /> : null}

            <DatabaseBrowser
                connectionId={id}
                connectionName={connection.name}
                databaseName={connection.database_name}
                engine={connection.engine}
                allowWrites={connection.allow_writes}
                schema={schema}
                runQuery={runDatabaseQueryAction}
            />
        </div>
    );
}
