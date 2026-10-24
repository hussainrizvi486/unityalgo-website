'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { parseModuleList } from '@/lib/app-modules';
import { typeChangeProblem } from '@/lib/app-catalog-guards';
export interface AppCatalogState {
    error?: string;
    success?: string;
}
export async function saveAppCatalogAction(
    _previous: AppCatalogState | undefined,
    data: FormData,
): Promise<AppCatalogState> {
    await requireAdmin();
    const id = String(data.get('id') || '');
    const name = String(data.get('name') || '').trim();
    const slug = String(data.get('slug') || '')
        .trim()
        .toLowerCase();
    const description = String(data.get('description') || '').trim();
    const category = String(data.get('category') || '').trim();
    const appType = String(data.get('appType') || 'application');
    if (appType !== 'application' && appType !== 'module') return { error: 'Choose an application type.' };
    const parsedModules = parseModuleList(String(data.get('modules') || ''));
    if (parsedModules.error) return { error: parsedModules.error };
    // A module entry installs no app, so it has no Frappe app name; an application has no module list.
    const frappeAppName = appType === 'module' ? null : String(data.get('frappeAppName') || '').trim() || null;
    const modules = appType === 'module' ? parsedModules.modules : [];
    const iconUrl = String(data.get('iconUrl') || '').trim() || null;
    const minPlanId = String(data.get('minPlanId') || '').trim() || null;
    const isInstallable = data.get('isInstallable') === 'on';
    if (
        !name ||
        name.length > 100 ||
        !/^[a-z][a-z0-9-]{1,60}$/.test(slug) ||
        !description ||
        description.length > 2000 ||
        !category ||
        category.length > 50
    )
        return {
            error: 'Enter a name, a valid lowercase slug, description, and category.',
        };
    if (iconUrl && (iconUrl.length > 500 || !/^(https?:\/\/|\/(?!\/))/i.test(iconUrl)))
        return { error: 'The icon must be an uploaded image or an http(s) address.' };
    if (minPlanId && !(await db.query.plan.findFirst({ where: eq(schema.plan.id, minPlanId), columns: { id: true } })))
        return { error: 'Choose one of the listed plans.' };
    if (frappeAppName && !/^[a-z][a-z0-9_]{0,100}$/.test(frappeAppName))
        return {
            error: 'Frappe application names use lowercase letters, numbers and underscores.',
        };
    if (appType === 'application' && isInstallable && !frappeAppName)
        return {
            error: 'An installable application needs a Frappe application name.',
        };
    if (appType === 'module' && isInstallable && modules.length === 0)
        return { error: 'An installable module needs at least one module name.' };
    const fields = {
        name,
        slug,
        description,
        category,
        iconUrl,
        minPlanId,
        appType,
        modules,
        frappeAppName,
        isInstallable,
        isActive: data.get('isActive') === 'on',
    };
    if (id) {
        const current = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
        const problem = current ? await typeChangeProblem(current, appType) : null;
        if (problem) return { error: problem };
    }
    try {
        if (id) one(await db.update(schema.appCatalog).set(fields).where(eq(schema.appCatalog.id, id)).returning({ id: schema.appCatalog.id }), 'Application');
        else await db.insert(schema.appCatalog).values(fields);
    } catch {
        return {
            error: 'Could not save the application. Check that its slug is unique.',
        };
    }
    revalidatePath('/admin/apps');
    revalidatePath('/dashboard/app-store');
    revalidatePath('/dashboard/sites/new');
    return { success: 'Application saved.' };
}
