'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
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
    const frappeAppName =
        String(data.get('frappeAppName') || '').trim() || null;
    const iconUrl = String(data.get('iconUrl') || '').trim() || null;
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
    if (frappeAppName && !/^[a-z][a-z0-9_]{0,100}$/.test(frappeAppName))
        return {
            error: 'Frappe application names use lowercase letters, numbers and underscores.',
        };
    if (isInstallable && !frappeAppName)
        return {
            error: 'An installable application needs a Frappe application name.',
        };
    const fields = {
        name,
        slug,
        description,
        category,
        iconUrl,
        frappeAppName,
        isInstallable,
        isActive: data.get('isActive') === 'on',
    };
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
