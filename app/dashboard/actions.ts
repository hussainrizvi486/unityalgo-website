'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { findAlgoSuitePlan } from '@/lib/products';
import {
    requireCustomer,
    requireCustomerSession,
} from '@/lib/customer-session';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';
import { controller, ControllerError } from '@/lib/controller-client';
import { trialDaysFor, trialEligibility } from '@/lib/site-trials';
import { sendSiteEmail } from '@/lib/site-emails';
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
    const [plan, currency, apps] = await Promise.all([
        findAlgoSuitePlan(values.planId),
        db.query.currency.findFirst({
            where: and(eq(schema.currency.code, values.currency), eq(schema.currency.isActive, true)),
            columns: { code: true },
        }),
        values.apps.length
            ? db.query.appCatalog.findMany({
                  where: and(
                      inArray(schema.appCatalog.id, values.apps),
                      eq(schema.appCatalog.isActive, true),
                      eq(schema.appCatalog.isInstallable, true),
                      eq(schema.appCatalog.source, 'image'),
                      or(isNull(schema.appCatalog.priceAmount), eq(schema.appCatalog.priceAmount, 0)),
                      isNotNull(schema.appCatalog.frappeAppName),
                  ),
              })
            : Promise.resolve([]),
    ]);
    if (!plan) return { error: 'The selected plan is no longer available.' };
    if (!currency) return { error: 'The selected currency is not available.' };
    if (apps.length !== new Set(values.apps).size)
        return { error: 'One of the selected applications is unavailable.' };
    const trialDays = trialDaysFor(plan, await trialEligibility(user.id));
    if (plan.priceAmount == null && plan.trialDays && !trialDays)
        return { error: 'You have already used the free trial. Choose a paid plan to create another site.' };
    let site;
    try {
        site = await controller.sites.create({
            ...(trialDays ? { trial_days: trialDays } : {}),
            user_id: user.id,
            name: values.slug,
            slug: values.slug,
            request_key: text('requestKey'),
            app_names: apps.map((app) => app.frappeAppName),
            plan_id: plan.id,
            plan_name: plan.name,
            plan_vcpu: plan.vcpu,
            plan_ram_mb: plan.ramMb,
            plan_storage_gb: plan.storageGb,
            plan_user_limit: plan.userLimit,
            // Handed to Frappe's setup wizard; the controller does not store these.
            company_name: values.companyName,
            country: values.country,
            currency: currency.code,
            coa_type: values.coaType,
            owner_email: values.email,
            owner_password: values.password,
        });
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again or contact support.',
        };
    }
    await db
        .insert(schema.notification)
        .values({
            userId: user.id,
            eventKey: `site:${site.id}:created`,
            title: 'Site creation requested',
            body: `${site.name} has been added. You can follow its installation progress.`,
            href: `/dashboard/sites/${site.id}`,
        })
        .onConflictDoNothing({ target: [schema.notification.userId, schema.notification.eventKey] });
    try {
        await sendSiteEmail('initiated', site, user.email);
    } catch {
        // Email trouble must not undo a site that is already being created.
    }
    revalidatePath('/dashboard', 'layout');
    redirect(`/dashboard/sites/${site.id}`);
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
    const user = await requireCustomer();
    const plan = await findAlgoSuitePlan(String(data.get('planId') || ''));
    if (!plan) return { error: 'That plan is not available.' };
    try {
        await controller.sites.changePlan(String(data.get('siteId') || ''), user.id, {
            plan_id: plan.id,
            plan_name: plan.name,
            plan_vcpu: plan.vcpu,
            plan_ram_mb: plan.ramMb,
            plan_storage_gb: plan.storageGb,
            plan_user_limit: plan.userLimit,
        });
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again.',
        };
    }
    revalidatePath('/dashboard/sites');
    return { success: `Switching to ${plan.name}…` };
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
