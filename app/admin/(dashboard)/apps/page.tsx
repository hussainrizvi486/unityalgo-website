import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { controller } from '@/lib/controller-client';
import { AdminPageHeader, AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { formatDateTime } from '@/lib/admin-format';
import { AppsList, type AppRow } from './apps-list';

export const metadata = { title: 'App Store' };

interface PageProps {
    searchParams: Promise<{ error?: string; done?: string }>;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
    await requireAdmin();
    const params = await searchParams;
    const apps = await db.query.appCatalog.findMany({
        orderBy: [asc(schema.appCatalog.sortOrder), asc(schema.appCatalog.name)],
    });

    const summary = await controller.apps.summary().then((r) => r.results).catch(() => null);

    const rows: AppRow[] = apps.map((app) => {
        const installed = app.frappeAppName ? summary?.[app.frappeAppName] : undefined;
        const behind = installed && app.latestCommit
            ? Object.entries(installed.commits).reduce((total, [commit, count]) => total + (commit && commit !== app.latestCommit ? count : 0), 0)
            : 0;
        return {
            id: app.id,
            name: app.name,
            slug: app.slug,
            category: app.category,
            frappeAppName: app.frappeAppName,
            source: app.source === 'github' ? 'github' : 'image',
            repo: app.repoUrl ? app.repoUrl.replace('https://github.com/', '') : null,
            branch: app.branch,
            version: app.latestVersion,
            commit: app.latestCommit,
            compatibility: app.compatibility,
            installedOn: installed?.sites ?? 0,
            behind,
            tracked: summary !== null,
            visible: app.isActive,
            checked: app.lastCheckedAt ? formatDateTime(app.lastCheckedAt) : null,
        };
    });

    const updates = rows.filter((row) => row.behind > 0).length;

    return (
        <div>
            <AdminPageHeader
                title="App Store"
                subtitle={
                    `${rows.length} application${rows.length === 1 ? '' : 's'}`
                    + (updates ? ` · ${updates} with updates to roll out` : '')
                }
                action={{ label: 'Add application', href: '/admin/apps/new' }}
            >
                <Button asChild variant="outline">
                    <Link href="/admin/apps/github"><Github className="size-4" />GitHub account</Link>
                </Button>
            </AdminPageHeader>
            {params.error && <AdminPageError message={params.error} />}
            {params.done && <AdminPageNotice message={params.done} />}
            <AppsList rows={rows} />
        </div>
    );
}
