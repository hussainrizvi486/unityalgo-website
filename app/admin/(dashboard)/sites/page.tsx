import { controller, ControllerError, type AdminSite } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { forceDeleteSiteAction } from '@/app/admin/controller-actions';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { formatDateTime } from '@/lib/admin-format';
import { SitesList, type SiteRow } from './sites-list';

export const metadata = { title: 'Sites' };

interface PageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function AdminSitesPage({ searchParams }: PageProps) {
    await requireAdmin();
    const params = await searchParams;

    let sites: AdminSite[];
    try {
        sites = (await controller.sites.adminList()).results ?? [];
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    // A stopped worker looks like operations that stay "queued" forever, so say so plainly.
    const queue = await controller.sites.adminQueue().catch(() => null);

    const rows: SiteRow[] = sites.map((site) => ({
        id: site.id,
        name: site.name,
        domain: site.domain,
        owner: site.owner_account_email,
        plan: site.plan_name ?? '—',
        server: site.server_name,
        database: site.db_server ?? 'Own container',
        created: formatDateTime(site.created_at),
        status: site.status,
        message: site.error ?? site.message,
        logHref: `/admin/logs?q=${encodeURIComponent(site.slug)}`,
    }));

    const attention = rows.filter((row) => ['failed', 'cleanup_required'].includes(row.status)).length;

    return (
        <div>
            <AdminPageHeader
                title="Sites"
                subtitle={
                    `${rows.length} customer site${rows.length === 1 ? '' : 's'}`
                    + (attention ? ` · ${attention} need attention` : '')
                }
            />
            {queue && queue.workers === 0 && (
                <AdminPageError
                    message={`No background worker is running, so site operations are not being processed${
                        queue.waiting || queue.sites_waiting
                            ? ` (${queue.waiting ?? 0} job${queue.waiting === 1 ? '' : 's'} waiting, ${queue.sites_waiting} site${queue.sites_waiting === 1 ? '' : 's'} affected)`
                            : ''
                    }. Start it with "npm run dev:all", or "python main.py worker" in the controller folder.`}
                />
            )}
            {params.error && <AdminPageError message={params.error} />}
            <SitesList rows={rows} removeAction={forceDeleteSiteAction} />
        </div>
    );
}
