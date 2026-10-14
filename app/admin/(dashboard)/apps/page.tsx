import { requireAdmin } from '@/lib/admin-session';
import { prisma } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AppCatalogForm } from './app-form';
export default async function ApplicationsPage() {
    await requireAdmin();
    const apps = await prisma.appCatalog.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return (
        <div className="portal-detail">
            <AdminPageHeader
                title="Application catalogue"
                subtitle="Manage the applications shown in the customer App Store."
            />
            <div className="mt-6 space-y-4">
                {apps.map((app) => (
                    <details
                        key={app.id}
                        className="rounded-lg border border-ink-200 p-5"
                    >
                        <summary className="cursor-pointer font-semibold">
                            {app.name}
                            <span className="ml-3 portal-text-caption font-normal text-ink-500">
                                {app.category} ·{' '}
                                {app.isActive ? 'Visible' : 'Hidden'} ·{' '}
                                {app.isInstallable
                                    ? 'Installation enabled'
                                    : 'Requires setup'}
                            </span>
                        </summary>
                        <AppCatalogForm app={app} />
                    </details>
                ))}
                <details className="rounded-lg border border-ink-200 p-5">
                    <summary className="cursor-pointer font-semibold">
                        Add application
                    </summary>
                    <AppCatalogForm />
                </details>
            </div>
        </div>
    );
}
