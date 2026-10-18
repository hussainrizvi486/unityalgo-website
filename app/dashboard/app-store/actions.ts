'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomer } from '@/lib/customer-session';
import { controller, ControllerError } from '@/lib/controller-client';
import { BillingError, cancelPurchase, isPaidApp, purchaseApp } from '@/lib/app-billing';

export interface InstallResult {
    error?: string;
    ok?: boolean;
    charged?: boolean;
}

export async function installAppAction(input: { appId: string; siteId: string }): Promise<InstallResult> {
    const user = await requireCustomer();
    const app = await db.query.appCatalog.findFirst({
        where: and(eq(schema.appCatalog.id, input.appId), eq(schema.appCatalog.isActive, true), eq(schema.appCatalog.isInstallable, true)),
    });
    if (!app?.frappeAppName) return { error: 'This application is not available to install.' };
    if (app.source === 'github' && app.compatibility !== 'compatible') return { error: 'This application has not been verified for your sites yet.' };

    let site;
    try {
        site = await controller.sites.get(input.siteId, user.id);        // also proves the site is theirs
    } catch (error) {
        if (error instanceof ControllerError && error.status === 404) return { error: 'That site was not found.' };
        return { error: 'Site hosting is unavailable right now. Please try again shortly.' };
    }
    if (site.apps.includes(app.frappeAppName)) return { error: 'This application is already installed on that site.' };
    if (site.status !== 'ready' || site.activity) return { error: 'Your site is busy or not running. Try again once it is idle and running.' };

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

    try {
        await controller.apps.installOnSite(site.id, {
            user_id: user.id,
            app_name: app.frappeAppName,
            source: app.source === 'github' ? 'github' : 'image',
            repo_url: app.repoUrl,
            branch: app.branch,
        });
    } catch (error) {
        if (purchase) await cancelPurchase(purchase).catch(() => undefined);
        return { error: error instanceof ControllerError && error.status < 500 ? error.message : 'The install could not be started. You have not been charged. Please try again.' };
    }
    revalidatePath(`/dashboard/sites/${site.id}`);
    revalidatePath('/dashboard/sites');
    return { ok: true, charged: Boolean(purchase) };
}

export async function removeAppAction(input: { appId: string; siteId: string }): Promise<InstallResult> {
    const user = await requireCustomer();
    const app = await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.id, input.appId) });
    if (!app?.frappeAppName) return { error: 'That application was not found.' };
    try {
        await controller.apps.removeFromSite(input.siteId, user.id, app.frappeAppName);
    } catch (error) {
        return { error: error instanceof ControllerError && error.status < 500 ? error.message : 'The removal could not be started. Please try again.' };
    }
    revalidatePath(`/dashboard/sites/${input.siteId}`);
    return { ok: true };
}
