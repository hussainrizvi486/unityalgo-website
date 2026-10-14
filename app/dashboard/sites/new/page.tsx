import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireCustomer } from '@/lib/customer-session';
import { prisma } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { Notice } from '@/components/ui/notice';
import { SiteForm } from './site-form';
export const metadata = { title: 'Create a site' };
export default async function CreateSitePage({
    searchParams,
}: {
    searchParams: Promise<{ app?: string }>;
}) {
    await requireCustomer();
    const { app } = await searchParams;
    const catalog = await prisma.appCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
            id: true,
            name: true,
            isInstallable: true,
            frappeAppName: true,
        },
    });
    let capabilities;
    try {
        capabilities = await controller.sites.capabilities();
    } catch {
        capabilities = null;
    }
    return (
        <div className="mx-auto portal-page">
            <Link
                href="/dashboard/sites"
                className="portal-text-body text-ink-500 hover:underline"
            >
                Back to sites
            </Link>
            <h1 className="portal-page-title mt-6">
                Create a Frappe site
            </h1>
            <p className="mt-3 portal-text-body leading-7 text-ink-600">
                Give your workspace a name, choose available applications, and
                set its administrator password. An eligible server is selected
                automatically.
            </p>
            {!capabilities?.configured && (
                <Notice tone="warning" className="mt-6">
                    Site creation is not available yet. Contact support or try
                    again when site hosting is configured.
                </Notice>
            )}
            <SiteForm
                requestKey={randomUUID()}
                selectedApp={app}
                available={Boolean(capabilities?.configured)}
                apps={catalog.map((item) => ({
                    id: item.id,
                    name: item.name,
                    available: Boolean(
                        item.isInstallable &&
                        item.frappeAppName &&
                        capabilities?.apps.includes(item.frappeAppName),
                    ),
                }))}
            />
        </div>
    );
}
