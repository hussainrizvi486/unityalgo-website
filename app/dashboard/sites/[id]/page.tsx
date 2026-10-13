import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { Notice } from '@/components/ui/notice';
import { SiteStatus } from './site-status';
import { prisma } from '@/lib/db';
export default async function SiteDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await requireCustomer();
    const { id } = await params;
    let site;
    try {
        site = await controller.sites.get(id, user.id);
    } catch (error) {
        if (error instanceof ControllerError && error.status === 404)
            notFound();
        return (
            <Notice tone="warning">
                Site hosting is unavailable. Your site has not been changed. Try
                again shortly.
            </Notice>
        );
    }
    await recordSiteNotification(user.id, site);
    const applications = await prisma.appCatalog.findMany({
        where: { frappeAppName: { in: site.apps } },
        select: { name: true, frappeAppName: true },
    });
    const applicationNames = Object.fromEntries(
        applications
            .filter((app) => app.frappeAppName !== 'erpnext')
            .map((app) => [app.frappeAppName!, app.name]),
    );
    return (
        <SiteStatus
            initial={site}
            applicationNames={{
                ...applicationNames,
                erpnext: 'ERPNext',
                frappe: 'Frappe',
            }}
        />
    );
}
