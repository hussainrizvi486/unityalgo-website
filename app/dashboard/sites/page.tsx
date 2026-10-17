import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireCustomer } from '@/lib/customer-session';
import { controller } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SitesGrid } from './sites-grid';
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
        <div className="mx-auto portal-page">
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="portal-text-caption font-semibold uppercase tracking-wider text-primary">
                        Your workspaces
                    </p>
                    <h1 className="portal-page-title mt-2">
                        Sites
                    </h1>
                    <p className="mt-3 portal-text-body text-foreground/70">
                        Manage your Frappe sites and follow their installation
                        progress.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button asChild className="">
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
            ) : (
                <SitesGrid initial={sites} />
            )}
        </div>
    );
}
