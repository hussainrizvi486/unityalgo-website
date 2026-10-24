'use server';
import { wantsCredits } from '@/lib/billing-features';
import { assertSiteBillingAccess } from '@/lib/site-billing-lifecycle';
import { CheckoutError, reportBillingFailure } from '@/lib/billing-errors';
import { cancelSiteOrder } from '@/lib/site-orders';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
    requireCustomer,
    requireCustomerSession,
} from '@/lib/customer-session';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';
import { controller, ControllerError } from '@/lib/controller-client';
import { findResumableOrder, saveSiteOrder, startSiteOrderPayment, provisionSiteOrder, SiteOrderError } from '@/lib/site-orders';
import { reconcilePaddleTransaction } from '@/lib/paddle-sync';
import { validateSiteWizard, type SiteWizardValues } from '@/lib/site-wizard';

export interface PortalActionState {
    error?: string;
    success?: string;
}

/** Records that the portal tour was finished or skipped, so it is not offered again on its own. */
export async function completeTourAction() {
    const user = await requireCustomer();
    await db.update(schema.user).set({ tourCompletedAt: new Date() }).where(eq(schema.user.id, user.id));
}

export async function revokeSessionAction(formData: FormData) {
    const current = await requireCustomerSession();
    const id = String(formData.get('sessionId') || '');
    await db
        .update(schema.loginSession)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(schema.loginSession.id, id),
                eq(schema.loginSession.userId, current.userId),
                isNull(schema.loginSession.revokedAt),
            ),
        );
    if (id === current.sessionId) {
        (await cookies()).delete(CUSTOMER_SESSION_COOKIE);
        redirect('/login');
    }
    revalidatePath('/dashboard/settings');
}

export async function createSiteAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    const text = (key: string) => String(data.get(key) || '');
    const values: SiteWizardValues = {
        slug: text('slug').trim().toLowerCase(),
        companyName: text('companyName').trim(),
        country: text('country'),
        currency: text('currency').toUpperCase(),
        coaType: text('coaType'),
        planId: text('planId'),
        apps: data.getAll('apps').map(String),
        email: text('email').trim().toLowerCase(),
        password: text('password'),
        confirmPassword: text('confirmPassword'),
    };
    const problems = Object.values(validateSiteWizard(values));
    if (problems.length) return { error: problems[0] };
    let order;
    try { order = await saveSiteOrder(user.id, text('requestKey'), values); }
    catch (error) {
        // The name is held by this customer's own unfinished setup (for example after pressing Back): continue it.
        const resumable = values.slug ? await findResumableOrder(user.id, values.slug).catch(() => undefined) : undefined;
        if (resumable) redirect(`/dashboard/sites/orders/${resumable.id}`);
        return { error: error instanceof ControllerError ? 'Site hosting is temporarily unavailable. Try again before paying.' : error instanceof SiteOrderError ? error.message : 'Site setup could not be saved. The site name may already be reserved; please try again.' };
    }
    redirect(`/dashboard/sites/orders/${order.id}`);
}

export async function startSitePaymentAction(orderId: string, useCredits = true) {
    const session = await requireCustomerSession();
    try {
        const result = await startSiteOrderPayment(session.userId, orderId, wantsCredits(useCredits));
        if (result.authorized) await provisionSiteOrder(orderId);
        return { ok: true as const, ...result };
    } catch (error) {
        if (error instanceof ControllerError) return { ok: false as const, error: 'Site hosting is temporarily unavailable. Your details are saved; please retry.' };
        if (error instanceof SiteOrderError || error instanceof CheckoutError) return { ok: false as const, error: error.message };
        const failure = reportBillingFailure(error, { action: 'start_site_payment', orderId });
        return { ok: false as const, error: failure.message };
    }
}

export async function sitePaymentStatusAction(orderId: string, verify = false) {
    const session = await requireCustomerSession();
    let order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, orderId), eq(schema.siteOrder.userId, session.userId)) });
    if (!order) throw new Error('Site setup not found.');
    if (verify && order.paddleTransactionId && order.status === 'AWAITING_PAYMENT') {
        await reconcilePaddleTransaction(order.paddleTransactionId);
    }
    await provisionSiteOrder(order.id);
    order = await db.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, order.id) });
    return { status: order!.status, siteId: order!.siteId, error: order!.error };
}

const SITE_ACTIONS = ['stop', 'start', 'restart', 'backup', 'deactivate', 'reactivate'] as const;
const ACTION_DONE: Record<(typeof SITE_ACTIONS)[number], string> = {
    stop: 'Stopping your site…',
    start: 'Starting your site…',
    restart: 'Restarting your site…',
    backup: 'Backup started. It will appear in the list when it finishes.',
    deactivate: 'Deactivating your site…',
    reactivate: 'Reactivating your site…',
};

export async function siteActionAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    const action = String(data.get('action') || '') as (typeof SITE_ACTIONS)[number];
    if (!SITE_ACTIONS.includes(action)) return { error: 'Unknown action.' };
    try {
        if (['start', 'reactivate', 'restart'].includes(String(data.get('action')))) await assertSiteBillingAccess(user.id, String(data.get('siteId') || ''));
        await controller.sites.action(String(data.get('siteId') || ''), user.id, action);
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success: ACTION_DONE[action] };
}

export async function deleteSiteAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    try {
        await controller.sites.remove(
            String(data.get('siteId') || ''),
            user.id,
            String(data.get('confirm') || ''),
        );
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success: 'Deleting your site…' };
}

export async function changePlanAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    await requireCustomer();
    void data;
    return { error: 'Use Review prorated payment on the site to confirm a paid plan change.' };
}

export async function resetSitePasswordAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    const password = String(data.get('newPassword') || '');
    if (password.length < 12 || password.length > 128)
        return { error: 'Password must be 12–128 characters.' };
    if (password !== String(data.get('confirmPassword') || ''))
        return { error: 'Passwords do not match.' };
    try {
        await controller.sites.resetPassword(String(data.get('siteId') || ''), user.id, password);
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    return { success: 'Your site password was changed. Everyone is signed out and must use the new password.' };
}

export async function backupSettingsAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    const retention = Number(data.get('retention'));
    if (!Number.isInteger(retention) || retention < 1 || retention > 30)
        return { error: 'Keep between 1 and 30 backups.' };
    try {
        await controller.sites.backupSettings(
            String(data.get('siteId') || ''),
            user.id,
            String(data.get('schedule') || ''),
            retention,
        );
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    return { success: 'Backup schedule saved.' };
}

export async function restoreBackupAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    try {
        await controller.sites.restore(
            String(data.get('siteId') || ''),
            user.id,
            String(data.get('stamp') || ''),
            String(data.get('confirm') || ''),
        );
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success: 'Restoring your backup…' };
}

async function domainCall(run: () => Promise<unknown>, success: string): Promise<PortalActionState> {
    try {
        await run();
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success };
}

export async function addDomainAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    return domainCall(
        () => controller.sites.addDomain(String(data.get('siteId') || ''), user.id, String(data.get('domain') || '')),
        'Domain added. Create the DNS record below, then verify it.',
    );
}

export async function verifyDomainAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    const siteId = String(data.get('siteId') || '');
    let result: { status: string; error: string | null } | undefined;
    const outcome = await domainCall(async () => {
        result = await controller.sites.verifyDomain(siteId, user.id, String(data.get('domainId') || ''));
    }, 'Checked.');
    if (outcome.error) return outcome;
    return result?.status === 'active'
        ? { success: 'Verified. Your domain is live; the HTTPS certificate follows within a few minutes.' }
        : { error: result?.error || 'DNS does not point at your site yet.' };
}

export async function removeDomainAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    return domainCall(
        () => controller.sites.removeDomain(String(data.get('siteId') || ''), user.id, String(data.get('domainId') || '')),
        'Domain removed.',
    );
}

export async function retrySiteAction(
    _previous: PortalActionState | undefined,
    data: FormData,
): Promise<PortalActionState> {
    const user = await requireCustomer();
    try {
        await assertSiteBillingAccess(user.id, String(data.get('siteId') || ''));
        await controller.sites.retry(String(data.get('siteId') || ''), user.id);
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success: 'Provisioning has been queued again.' };
}

export async function cancelSiteSetupAction(orderId: string) {
    const session = await requireCustomerSession();
    try { await cancelSiteOrder(session.userId, orderId); return { ok: true as const }; }
    catch (error) {
        // Say why when the reason is safe to show: a payment in progress is different from a temporary failure.
        if (error instanceof SiteOrderError || error instanceof CheckoutError) return { ok: false as const, error: error.message };
        reportBillingFailure(error, { action: 'cancel_site_setup', orderId });
        return { ok: false as const, error: 'The setup could not be canceled right now. Please try again in a moment.' };
    }
}
