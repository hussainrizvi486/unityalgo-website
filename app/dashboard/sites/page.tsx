import Link from 'next/link';
import { Globe, Plus, ArrowUpRight } from 'lucide-react';
import { requireCustomer } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Badge } from '@/components/ui/badge';
import { PortalPanel } from '@/components/customer/portal-panel';
import { RefreshSites } from './refresh-sites';
export const metadata = { title: 'Sites' };
export default async function SitesPage() {
    const user = await requireCustomer();
    let sites;
    try {
        sites = (await controller.sites.list(user.id)).results;
        await Promise.all(
            sites.map((site) => recordSiteNotification(user.id, site)),
        );
    } catch {
        sites = null;
    }
    return (
        <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                        Your workspaces
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Sites
                    </h1>
                    <p className="mt-3 text-sm text-ink-600">
                        Manage your Frappe sites and follow their installation
                        progress.
                    </p>
                </div>
                <div className="flex gap-3">
                    <RefreshSites
                        pending={Boolean(
                            sites?.some(
                                (site) =>
                                    ![
                                        'ready',
                                        'failed',
                                        'cleanup_required',
                                    ].includes(site.status),
                            ),
                        )}
                    />
                    <Button asChild className="h-8">
                        <Link href="/dashboard/sites/new">
                            <Plus className="size-4" />
                            Create site
                        </Link>
                    </Button>
                </div>
            </div>
            {sites === null ? (
                <Notice tone="warning" className="mt-8">
                    Site hosting is temporarily unavailable. Your existing sites
                    have not been changed. Try refreshing or contact support.
                </Notice>
            ) : sites.length ? (
                <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {sites.map((site) => (
                        <PortalPanel key={site.id}>
                            <div className="flex items-center justify-between gap-3">
                                <Globe className="size-6 text-brand" />
                                <Badge
                                    variant={
                                        site.status === 'ready'
                                            ? 'success'
                                            : [
                                                    'failed',
                                                    'cleanup_required',
                                                ].includes(site.status)
                                              ? 'error'
                                              : 'neutral'
                                    }
                                >
                                    {site.status.replaceAll('_', ' ')}
                                </Badge>
                            </div>
                            <h2 className="mt-5 text-xl font-semibold">
                                {site.name}
                            </h2>
                            <p className="mt-2 break-all text-sm text-ink-500">
                                {site.domain}
                            </p>
                            <p className="mt-4 text-xs text-ink-500">
                                Server: {site.server_name}
                            </p>
                            <p className="mt-3 min-h-12 text-sm leading-6 text-ink-600">
                                {site.message}
                            </p>
                            <Link
                                href={`/dashboard/sites/${site.id}`}
                                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand"
                            >
                                View site <ArrowUpRight className="size-4" />
                            </Link>
                        </PortalPanel>
                    ))}
                </div>
            ) : (
                <div className="mt-10 rounded-xl border border-dashed border-ink-300 px-6 py-16 text-center">
                    <Globe className="mx-auto size-10 text-ink-400" />
                    <h2 className="mt-5 text-xl font-semibold">
                        Your first site starts here.
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-600">
                        Choose a name and your applications. We will assign an
                        available server and start the Frappe installation.
                    </p>
                    <Button asChild className="mt-6 py-2">
                        <Link href="/dashboard/sites/new">
                            Create your first site
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
