import { controller, ControllerError, type ControllerDatabase } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { testDatabaseAction } from '@/app/admin/controller-actions';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader, AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { DatabasesList, type DatabaseRow } from './databases-list';

interface PageProps {
    searchParams: Promise<{ error?: string; tested?: string }>;
}

export default async function AdminDatabasesPage({ searchParams }: PageProps) {
    await requireAdmin();
    const params = await searchParams;

    let databases: ControllerDatabase[];
    try {
        databases = (await controller.databases.list()).results ?? [];
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    const clusters = databases.filter((db) => db.role === 'cluster');
    const external = databases.length - clusters.length;

    const rows: DatabaseRow[] = databases.map((db) => ({
        id: db.id,
        name: db.name,
        kind:
            (db.role === 'cluster' ? (db.is_default ? 'Default cluster' : 'Cluster') : 'External')
            + (db.host_from_worker ? ` · workers use ${db.host_from_worker}` : ''),
        isDefault: db.is_default,
        address: `${db.host}:${db.port}/${db.database_name}`,
        username: db.username,
        sslmode: db.sslmode,
        lastTestStatus: db.last_test_status,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Databases"
                subtitle={
                    `${clusters.length} cluster${clusters.length === 1 ? '' : 's'} hosting tenants`
                    + (external > 0 ? `, ${external} external` : '')
                }
                action={{ label: 'Register Database', href: '/admin/databases/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            {params.tested && <AdminPageNotice message={params.tested} />}
            <DatabasesList rows={rows} testAction={testDatabaseAction} />
        </div>
    );
}
