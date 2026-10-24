import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { moduleKey, unionModules } from '@/lib/app-modules';

type App = typeof schema.appCatalog.$inferSelect;
type Client = Pick<typeof db, 'select' | 'insert' | 'delete' | 'execute'>;

/** The module-type entries a site has switched on, with the modules each one provides. */
export async function siteModuleApps(siteId: string, client: Client = db) {
    return client
        .select({ id: schema.appCatalog.id, name: schema.appCatalog.name, modules: schema.appCatalog.modules, priceAmount: schema.appCatalog.priceAmount, priceCurrency: schema.appCatalog.priceCurrency })
        .from(schema.siteModuleApp)
        .innerJoin(schema.appCatalog, eq(schema.appCatalog.id, schema.siteModuleApp.appId))
        .where(eq(schema.siteModuleApp.siteId, siteId));
}

/** `module:<appId>` keys per site, so install dialogs can tell what a site already has. */
export async function moduleKeysBySite(siteIds: string[]) {
    const keys = new Map<string, string[]>();
    if (!siteIds.length) return keys;
    const rows = await db.select({ siteId: schema.siteModuleApp.siteId, appId: schema.siteModuleApp.appId }).from(schema.siteModuleApp).where(inArray(schema.siteModuleApp.siteId, siteIds));
    for (const row of rows) keys.set(row.siteId, [...(keys.get(row.siteId) ?? []), moduleKey(row.appId)]);
    return keys;
}

/**
 * Change a site's module entries and apply the result as one step, one change at a time per site. The site's domain settings
 * are rebuilt from every entry it has, so two overlapping changes must not each apply a list the other has not seen. If the
 * site cannot apply the list, the transaction rolls back and nothing is recorded or removed.
 */
async function changeModules<T>(siteId: string, change: (tx: Client) => Promise<{ proceed: boolean; result: T }>, userId: string) {
    return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`site-modules:${siteId}`}, 0))`);
        const outcome = await change(tx);
        if (!outcome.proceed) return { applied: null, result: outcome.result };
        const modules = unionModules((await siteModuleApps(siteId, tx)).map((entry) => entry.modules));
        return { applied: await controller.sites.applyModules(siteId, userId, modules), result: outcome.result };
    });
}

/** Switch a module entry on for a site, without switching any other entry off. */
export async function installModuleApp(input: { userId: string; app: App; siteId: string }) {
    const { userId, app, siteId } = input;
    const { applied, result } = await changeModules(siteId, async (tx) => {
        const [added] = await tx.insert(schema.siteModuleApp).values({ siteId, appId: app.id, userId }).onConflictDoNothing().returning({ id: schema.siteModuleApp.id });
        return { proceed: Boolean(added), result: Boolean(added) };
    }, userId);
    return { missing: applied?.missing ?? [], alreadyInstalled: !result };
}

/** Switch a module entry off. The remaining entries' modules stay in place. Returns false when the site did not have it. */
export async function removeModuleApp(input: { userId: string; appId: string; siteId: string }) {
    const { userId, appId, siteId } = input;
    const { result } = await changeModules(siteId, async (tx) => {
        const removed = await tx.delete(schema.siteModuleApp).where(and(eq(schema.siteModuleApp.siteId, siteId), eq(schema.siteModuleApp.appId, appId), eq(schema.siteModuleApp.userId, userId))).returning({ id: schema.siteModuleApp.id });
        return { proceed: removed.length > 0, result: removed.length > 0 };
    }, userId);
    return result;
}
