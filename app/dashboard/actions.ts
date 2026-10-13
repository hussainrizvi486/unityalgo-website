'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
    requireCustomer,
    requireCustomerSession,
} from '@/lib/customer-session';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';
import { controller, ControllerError } from '@/lib/controller-client';

export interface PortalActionState {
    error?: string;
    success?: string;
}

export async function revokeSessionAction(formData: FormData) {
    const current = await requireCustomerSession();
    const id = String(formData.get('sessionId') || '');
    await prisma.loginSession.updateMany({
        where: { id, userId: current.userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
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
    const appIds = data.getAll('apps').map(String);
    const apps = await prisma.appCatalog.findMany({
        where: {
            id: { in: appIds },
            isActive: true,
            isInstallable: true,
            frappeAppName: { not: null },
        },
    });
    if (apps.length !== new Set(appIds).size)
        return { error: 'One of the selected applications is unavailable.' };
    let site;
    try {
        site = await controller.sites.create({
            user_id: user.id,
            name: String(data.get('name') || ''),
            slug: String(data.get('slug') || ''),
            admin_password: String(data.get('adminPassword') || ''),
            request_key: String(data.get('requestKey') || ''),
            app_names: apps.map((app) => app.frappeAppName),
        });
    } catch (error) {
        return {
            error:
                error instanceof ControllerError && error.status < 500
                    ? error.message
                    : 'Site hosting is temporarily unavailable. Please try again or contact support.',
        };
    }
    await prisma.notification.upsert({
        where: {
            userId_eventKey: {
                userId: user.id,
                eventKey: `site:${site.id}:created`,
            },
        },
        update: {},
        create: {
            userId: user.id,
            eventKey: `site:${site.id}:created`,
            title: 'Site creation requested',
            body: `${site.name} has been added. You can follow its installation progress.`,
            href: `/dashboard/sites/${site.id}`,
        },
    });
    revalidatePath('/dashboard', 'layout');
    redirect(`/dashboard/sites/${site.id}`);
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
