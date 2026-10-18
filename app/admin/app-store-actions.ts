'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError, type AppInspection } from '@/lib/controller-client';
import { syncAppToPaddle } from '@/lib/paddle-catalog';

export interface InspectState {
    error?: string;
    data?: AppInspection;
}

export interface AppFormState {
    error?: string;
    success?: string;
}

function message(error: unknown) {
    if (error instanceof ControllerError) return error.message;
    throw error;
}

/** Columns that mirror what GitHub said about the repository and branch. */
function repositoryFields(info: AppInspection) {
    return {
        repoUrl: info.repo_url,
        branch: info.branch,
        defaultBranch: info.default_branch,
        branches: info.branches,
        publisher: info.publisher,
        latestCommit: info.commit.sha,
        latestCommitMessage: info.commit.message,
        latestCommitAt: info.commit.date ? new Date(info.commit.date) : null,
        latestVersion: info.version,
        frappeRange: info.frappe_range,
        compatibility: info.compatibility.status,
        compatibilityNote: info.compatibility.reason,
        lastCheckedAt: new Date(),
    };
}

function refreshPages(id?: string) {
    revalidatePath('/admin/apps');
    if (id) revalidatePath(`/admin/apps/${id}`);
    revalidatePath('/dashboard/app-store');
}

export async function inspectRepositoryAction(url: string, branch?: string): Promise<InspectState> {
    await requireAdmin();
    try {
        return { data: await controller.apps.inspect(url, branch || undefined) };
    } catch (error) {
        return { error: message(error) };
    }
}

const SLUG = /^[a-z][a-z0-9-]{1,60}$/;

export async function createGithubAppAction(
    _previous: AppFormState | undefined,
    data: FormData,
): Promise<AppFormState> {
    await requireAdmin();
    const url = String(data.get('repoUrl') ?? '').trim();
    const branch = String(data.get('branch') ?? '').trim();
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const category = String(data.get('category') ?? '').trim();

    let info: AppInspection;
    try {
        info = await controller.apps.inspect(url, branch || undefined);
    } catch (error) {
        return { error: message(error) };
    }

    const slug = String(data.get('slug') ?? '').trim().toLowerCase() || info.app_name.replaceAll('_', '-');
    if (!name || name.length > 100 || !description || description.length > 2000 || !category || category.length > 50 || !SLUG.test(slug))
        return { error: 'Enter a name, a valid lowercase slug, a description and a category.' };

    const existing = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.frappeAppName, info.app_name) });
    if (existing) return { error: `"${existing.name}" already uses the Frappe app ${info.app_name}. Open it to change its branch.` };

    let id: string;
    try {
        const [created] = await db
            .insert(schema.appCatalog)
            .values({
                name,
                slug,
                description,
                category,
                frappeAppName: info.app_name,
                isInstallable: false,
                isActive: data.get('isActive') === 'on',
                source: 'github',
                ...repositoryFields(info),
            })
            .returning({ id: schema.appCatalog.id });
        id = created.id;
    } catch {
        return { error: 'Could not save the application. Check that its slug is unique.' };
    }
    refreshPages(id);
    redirect(`/admin/apps/${id}`);
}

export async function refreshGithubAppAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
    if (!app?.repoUrl) redirect('/admin/apps');
    let notice: string;
    try {
        const info = await controller.apps.inspect(app.repoUrl, app.branch ?? undefined);
        await db.update(schema.appCatalog).set(repositoryFields(info)).where(eq(schema.appCatalog.id, id));
        const moved = info.commit.sha !== app.latestCommit;
        notice = moved
            ? `New version found: ${info.version ?? info.commit.sha.slice(0, 8)}.`
            : 'Already on the latest commit.';
    } catch (error) {
        refreshPages(id);
        redirect(`/admin/apps/${id}?error=${encodeURIComponent(message(error))}`);
    }
    refreshPages(id);
    redirect(`/admin/apps/${id}?done=${encodeURIComponent(notice)}`);
}

export async function changeAppBranchAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const branch = String(formData.get('branch') ?? '').trim();
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
    if (!app?.repoUrl || !branch) redirect('/admin/apps');
    try {
        const info = await controller.apps.inspect(app.repoUrl, branch);
        if (info.app_name !== app.frappeAppName)
            throw new ControllerError(`That branch contains the app "${info.app_name}", not "${app.frappeAppName}".`, 422);
        await db.update(schema.appCatalog).set(repositoryFields(info)).where(eq(schema.appCatalog.id, id));
    } catch (error) {
        redirect(`/admin/apps/${id}?error=${encodeURIComponent(message(error))}`);
    }
    refreshPages(id);
    redirect(`/admin/apps/${id}?done=${encodeURIComponent(`Now tracking ${branch}.`)}`);
}

export interface RolloutInput {
    appId: string;
    action: 'install' | 'update';
    siteIds?: string[];
    allSites?: boolean;
    allowUnverified?: boolean;
    note?: string;
}

export async function startRolloutAction(input: RolloutInput): Promise<{ error?: string; id?: string }> {
    const admin = await requireAdmin();
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, input.appId) });
    if (!app?.repoUrl || !app.branch || !app.frappeAppName) return { error: 'This application is not linked to a GitHub repository.' };
    try {
        const rollout = await controller.apps.startRollout({
            app_name: app.frappeAppName,
            repo_url: app.repoUrl,
            branch: app.branch,
            action: input.action,
            site_ids: input.siteIds,
            all_sites: input.allSites,
            allow_unverified: input.allowUnverified,
            note: input.note,
            created_by: admin.email,
        });
        refreshPages(app.id);
        revalidatePath('/admin/sites');
        return { id: rollout.id };
    } catch (error) {
        return { error: message(error) };
    }
}

export async function retryRolloutAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    let notice: string;
    try {
        const { queued } = await controller.apps.retryRollout(id);
        notice = `${queued} site${queued === 1 ? '' : 's'} queued again.`;
    } catch (error) {
        redirect(`/admin/apps/rollouts/${id}?error=${encodeURIComponent(message(error))}`);
    }
    revalidatePath(`/admin/apps/rollouts/${id}`);
    redirect(`/admin/apps/rollouts/${id}?done=${encodeURIComponent(notice)}`);
}

export async function scanSitesAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const back = id ? `/admin/apps/${id}` : '/admin/apps';
    const notice = 'Scanning every running site. Refresh in a minute.';
    try {
        await controller.apps.scan();
    } catch (error) {
        redirect(`${back}?error=${encodeURIComponent(message(error))}`);
    }
    redirect(`${back}?done=${encodeURIComponent(notice)}`);
}

export async function deleteAppAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
    if (!app) redirect('/admin/apps');
    if (app.frappeAppName) {
        const summary = await controller.apps.summary().catch(() => null);
        const installed = summary?.results[app.frappeAppName]?.sites ?? 0;
        if (installed > 0 && app.source === 'github')
            redirect(`/admin/apps/${id}?error=${encodeURIComponent(`It is installed on ${installed} site${installed === 1 ? '' : 's'}. Hide it instead.`)}`);
    }
    one(await db.delete(schema.appCatalog).where(eq(schema.appCatalog.id, id)).returning({ id: schema.appCatalog.id }), 'Application');
    refreshPages();
    redirect('/admin/apps');
}

export async function connectGithubAction(
    _previous: AppFormState | undefined,
    data: FormData,
): Promise<AppFormState> {
    const admin = await requireAdmin();
    const token = String(data.get('token') ?? '').trim();
    if (!token) return { error: 'Paste a GitHub personal access token.' };
    try {
        const account = await controller.github.connect(token, admin.email);
        revalidatePath('/admin/apps', 'layout');
        return { success: `Connected as ${account.login}.` };
    } catch (error) {
        return { error: message(error) };
    }
}

export async function disconnectGithubAction() {
    await requireAdmin();
    let notice = 'GitHub account disconnected. Private repositories can no longer be used.';
    try {
        await controller.github.disconnect();
    } catch (error) {
        notice = message(error);
        redirect(`/admin/apps/github?error=${encodeURIComponent(notice)}`);
    }
    revalidatePath('/admin/apps', 'layout');
    redirect(`/admin/apps/github?done=${encodeURIComponent(notice)}`);
}

export async function saveAppPricingAction(_previous: AppFormState | undefined, data: FormData): Promise<AppFormState> {
    await requireAdmin();
    const id = String(data.get('id') ?? '');
    const raw = String(data.get('priceAmount') ?? '').trim();
    const price = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(price) || price < 0 || price > 10_000) return { error: 'Enter a price between 0 and 10,000, or leave it blank for a free app.' };
    const amount = Math.round(price * 100) / 100;
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, id) });
    if (!app) return { error: 'Application not found.' };
    const installable = data.get('isInstallable') === 'on';
    if (installable && !app.frappeAppName) return { error: 'An installable application needs a Frappe application name.' };
    if (installable && app.source === 'github' && app.compatibility !== 'compatible')
        return { error: 'Only an app verified as compatible with your Frappe version can be offered to customers. Check for updates or choose another branch.' };
    await db.update(schema.appCatalog).set({ priceAmount: amount > 0 ? amount : null, isInstallable: installable }).where(eq(schema.appCatalog.id, id));
    refreshPages(id);
    const changed = app.paddlePriceId && (app.priceAmount ?? 0) !== amount;
    return { success: changed ? 'Saved. Sync the price to Paddle for it to apply to billing.' : 'Saved.' };
}

/** Push the app's price to Paddle, creating its recurring price the first time. */
export async function syncAppPricingAction(_previous: AppFormState | undefined, data: FormData): Promise<AppFormState> {
    await requireAdmin();
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, String(data.get('id') ?? '')) });
    if (!app) return { error: 'Application not found.' };
    if (!app.priceAmount || app.priceAmount <= 0) return { error: 'Set a price first. A free app has nothing to sync.' };
    try {
        const { priceId, created } = await syncAppToPaddle({
            appName: app.name,
            amount: app.priceAmount,
            currencyCode: app.priceCurrency,
            existingPriceId: app.paddlePriceId,
        });
        if (created) await db.update(schema.appCatalog).set({ paddlePriceId: priceId }).where(eq(schema.appCatalog.id, app.id));
        refreshPages(app.id);
        return { success: created ? 'Created the recurring price in Paddle.' : 'Paddle price updated.' };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Paddle rejected the sync.' };
    }
}
