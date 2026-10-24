'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomer } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { activePurchase, BillingError, cancelPurchase, isPaidApp, purchaseApp } from '@/lib/app-billing';
import { installModuleApp, removeModuleApp } from '@/lib/site-modules';
import { previewAppPurchase } from '@/lib/app-preview';
import { upgradeTarget } from '@/lib/app-compatibility';
import { loadPlanTiers } from '@/lib/app-plan-access';

export interface InstallResult {
    error?: string;
    /** The plan that would make the app work, when the site's plan is too low. */
    upgradeToPlanId?: string;
    ok?: boolean;
    charged?: boolean;
    /** Installed, but part of it could not be applied (for example a module name the site does not have). */
    warning?: string;
}

export async function installAppAction(input: { appId: string; siteId: string }): Promise<InstallResult> {
    const user = await requireCustomer();
    const app = await db.query.appCatalog.findFirst({
        where: and(eq(schema.appCatalog.id, input.appId), eq(schema.appCatalog.isActive, true), eq(schema.appCatalog.isInstallable, true)),
    });
    if (!app) return { error: 'This application is not available to install.' };
    // A module entry installs nothing: it switches on Frappe modules. An application installs a Frappe app.
    const isModule = app.appType === 'module';
    if (isModule ? app.modules.length === 0 : !app.frappeAppName) return { error: 'This application is not available to install.' };
    if (!isModule && app.source === 'github' && app.compatibility !== 'compatible') return { error: 'This application has not been verified for your sites yet.' };

    let site;
    try {
        site = await controller.sites.get(input.siteId, user.id);        // also proves the site is theirs
    } catch (error) {
        if (error instanceof ControllerError && error.status === 404) return { error: 'That site was not found.' };
        return { error: 'Site hosting is unavailable right now. Please try again shortly.' };
    }
    const alreadyThere = isModule
        ? Boolean(await db.query.siteModuleApp.findFirst({ where: and(eq(schema.siteModuleApp.siteId, site.id), eq(schema.siteModuleApp.appId, app.id)), columns: { id: true } }))
        : site.apps.includes(app.frappeAppName!);
    if (alreadyThere) return { error: 'This application is already installed on that site.' };
    if (site.status !== 'ready' || site.activity) return { error: 'Your site is busy or not running. Try again once it is idle and running.' };
    const tiers = await loadPlanTiers();
    const needed = upgradeTarget(app, tiers.find((tier) => tier.id === site.plan_id), tiers);
    if (needed) return { error: `${app.name} needs the ${needed.name} plan or higher. Upgrade this site's plan first, then install it.`, upgradeToPlanId: needed.id };

    let purchase;
    if (isPaidApp(app)) {
        if (site.trial) return { error: 'Paid apps can be added once you subscribe to this site\'s plan. Your free trial still includes the free apps.' };
        try {
            purchase = await purchaseApp({ userId: user.id, app, siteId: site.id, planId: site.plan_id });
        } catch (error) {
            if (error instanceof BillingError) return { error: error.message };
            throw error;
        }
    }

    let warning: string | undefined;
    try {
        if (isModule) {
            const result = await installModuleApp({ userId: user.id, app, siteId: site.id });
            if (result.missing.length) warning = `Installed, but your site does not have these modules: ${result.missing.join(', ')}. Please contact support.`;
        } else {
            await controller.apps.installOnSite(site.id, {
                user_id: user.id,
                app_name: app.frappeAppName!,
                source: app.source === 'github' ? 'github' : 'image',
                repo_url: app.repoUrl,
                branch: app.branch,
            });
        }
    } catch (error) {
        if (purchase) await cancelPurchase(purchase).catch(() => undefined);
        return { error: error instanceof ControllerError && error.status < 500 ? error.message : 'The install could not be started. You have not been charged. Please try again.' };
    }
    revalidatePath(`/dashboard/sites/${site.id}`);
    revalidatePath('/dashboard/sites');
    return { ok: true, charged: Boolean(purchase), warning };
}

export async function removeAppAction(input: { appId: string; siteId: string }): Promise<InstallResult> {
    const user = await requireCustomer();
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, input.appId) });
    if (!app) return { error: 'That application was not found.' };
    if (app.appType === 'module') {
        try {
            await controller.sites.get(input.siteId, user.id);        // proves the site is theirs
            if (!(await removeModuleApp({ userId: user.id, appId: app.id, siteId: input.siteId }))) return { error: 'That application is not installed on this site.' };
        } catch (error) {
            return { error: error instanceof ControllerError && error.status < 500 ? error.message : 'The removal could not be completed. Please try again.' };
        }
        // Stop billing straight away: nothing remains on the site to wait for.
        const purchase = await activePurchase(input.siteId, app.id);
        if (purchase) await cancelPurchase(purchase).catch(() => undefined);
        revalidatePath(`/dashboard/sites/${input.siteId}`);
        return { ok: true };
    }
    if (!app.frappeAppName) return { error: 'That application was not found.' };
    try {
        await controller.apps.removeFromSite(input.siteId, user.id, app.frappeAppName);
    } catch (error) {
        return { error: error instanceof ControllerError && error.status < 500 ? error.message : 'The removal could not be started. Please try again.' };
    }
    revalidatePath(`/dashboard/sites/${input.siteId}`);
    return { ok: true };
}

export interface InstallPreview {
    error?: string;
    ok?: boolean;
    chargeNow?: number;
    currency?: string;
    nextTotal?: number | null;
    nextBilledAt?: string | null;
}

/** The exact prorated amount a paid install would charge today, so the customer agrees before paying. */
export async function previewInstallAction(input: { appId: string; siteId: string }): Promise<InstallPreview> {
    const user = await requireCustomer();
    const app = await db.query.appCatalog.findFirst({ where: and(eq(schema.appCatalog.id, input.appId), eq(schema.appCatalog.isActive, true)) });
    if (!app || !isPaidApp(app)) return { error: 'This application is free.' };
    let site;
    try { site = await controller.sites.get(input.siteId, user.id); }
    catch { return { error: 'That site could not be found.' }; }
    if (site.trial) return { error: 'Paid apps can be added once you subscribe to this site\'s plan.' };
    try {
        return { ok: true, ...(await previewAppPurchase({ userId: user.id, app, siteId: site.id, planId: site.plan_id })) };
    } catch (error) {
        return { error: error instanceof BillingError ? error.message : 'The price could not be calculated. Please try again.' };
    }
}
