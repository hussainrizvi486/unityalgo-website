import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-session';
import { db } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { AppCatalogForm } from '../app-form';
import { GithubAppForm } from './github-form';

export const metadata = { title: 'Add application' };

export default async function NewApplicationPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
    await requireAdmin();
    const { source } = await searchParams;
    const builtIn = source === 'image';
    const categories = [...new Set((await db.query.appCatalog.findMany({ columns: { category: true } })).map((app) => app.category))].sort();

    const github = await controller.github.repositories().catch(() => ({ connected: false, results: [] }));

    return (
        <div className="portal-detail">
            <Link href="/admin/apps" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to App Store
            </Link>
            <h1 className="portal-page-title">Add application</h1>
            <div className="mt-4 inline-flex rounded-lg bg-muted p-1 portal-text-body">
                <Link href="/admin/apps/new" className={`rounded-md px-4 py-1.5 font-medium ${builtIn ? 'text-muted-foreground' : 'bg-card text-foreground shadow-sm'}`}>From GitHub</Link>
                <Link href="/admin/apps/new?source=image" className={`rounded-md px-4 py-1.5 font-medium ${builtIn ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Built into the image</Link>
            </div>
            {builtIn ? (
                <div className="mt-6 rounded-xl border border-border p-card">
                    <p className="portal-text-body text-muted-foreground">
                        For apps already inside the platform&rsquo;s Frappe image. They are installed when a site is created and updated with the image.
                    </p>
                    <AppCatalogForm />
                </div>
            ) : (
                <GithubAppForm categories={categories} connected={github.connected} repositories={github.results} />
            )}
        </div>
    );
}
