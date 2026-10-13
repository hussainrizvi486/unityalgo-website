import { requireCustomer } from '@/lib/customer-session';
import { prisma } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { AppStoreClient } from './store-client';
export const metadata = { title: 'App Store' };
export default async function AppStorePage() {
    await requireCustomer();
    const apps = await prisma.appCatalog.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            category: true,
            frappeAppName: true,
            isInstallable: true,
        },
    });
    let available: string[] = [];
    try {
        available = (await controller.sites.capabilities()).apps;
    } catch {
        /* Browsing the catalogue works even when hosting is offline. */
    }
    return (
        <AppStoreClient
            apps={apps.map((app) => ({
                ...app,
                available: Boolean(
                    app.isInstallable &&
                    app.frappeAppName &&
                    available.includes(app.frappeAppName),
                ),
            }))}
        />
    );
}
