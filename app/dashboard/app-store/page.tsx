import { requireCustomer } from '@/lib/customer-session';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { AppStoreClient } from './store-client';
export const metadata = { title: 'App Store' };
export default async function AppStorePage() {
    await requireCustomer();
    const apps = await db
        .select({
            id: schema.appCatalog.id,
            name: schema.appCatalog.name,
            slug: schema.appCatalog.slug,
            description: schema.appCatalog.description,
            category: schema.appCatalog.category,
            frappeAppName: schema.appCatalog.frappeAppName,
            publisher: schema.appCatalog.publisher,
            isInstallable: schema.appCatalog.isInstallable,
        })
        .from(schema.appCatalog)
        .where(eq(schema.appCatalog.isActive, true))
        .orderBy(asc(schema.appCatalog.sortOrder), asc(schema.appCatalog.name));
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
