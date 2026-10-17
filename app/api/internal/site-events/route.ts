import { timingSafeEqual } from 'node:crypto';
import { controller } from '@/lib/controller-client';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { recordSiteNotification } from '@/lib/customer-notifications';
import { sendSiteEmail, type SiteEmailEvent } from '@/lib/site-emails';
import { activePurchase, cancelPurchase } from '@/lib/app-billing';

const EVENTS: SiteEmailEvent[] = ['started', 'milestone', 'ready', 'failed', 'trial_ending', 'trial_ended', 'trial_converted'];

type AppEvent = 'app_installed' | 'app_failed' | 'app_removed' | 'app_removal_failed';
const APP_EVENTS: AppEvent[] = ['app_installed', 'app_failed', 'app_removed', 'app_removal_failed'];

/**
 * The result of an app install or removal the customer asked for.
 *
 * A failed install reverses the charge, because a paid app that did not install must not be billed. A finished removal
 * stops the charge, because the app is gone. A failed removal changes nothing: the app is still there and still billed.
 */
async function handleAppResult(site: Awaited<ReturnType<typeof controller.sites.get>>, userId: string, frappeApp: string, event: AppEvent) {
    const app = frappeApp
        ? await db.query.appCatalog.findFirst({ where: eq(schema.appCatalog.frappeAppName, frappeApp), columns: { id: true, name: true } })
        : null;
    const purchase = app ? await activePurchase(site.id, app.id) : null;
    let stopped = false;
    if ((event === 'app_failed' || event === 'app_removed') && purchase) {
        try {
            await cancelPurchase(purchase);
            stopped = true;
        } catch {
            // Billing could not be reached; the purchase stays active and the stale-purchase check retries it.
        }
    }
    const name = app?.name ?? frappeApp;
    const text = {
        app_installed: { title: `${name} installed on ${site.name}`, body: 'The app is ready to use.' },
        app_failed: {
            title: `${name} could not be installed on ${site.name}`,
            body: `Your site was returned to how it was.${purchase ? (stopped ? ' You were not charged.' : ' Any charge will be reversed shortly.') : ''}`,
        },
        app_removed: {
            title: `${name} removed from ${site.name}`,
            body: purchase ? (stopped ? 'You will no longer be charged for it.' : 'Billing will stop shortly.') : 'It has been removed from the site.',
        },
        app_removal_failed: { title: `${name} could not be removed from ${site.name}`, body: 'Your site was returned to how it was.' },
    }[event];
    await db
        .insert(schema.notification)
        .values({
            userId,
            eventKey: `site:${site.id}:app:${frappeApp}:${event}:${Date.now()}`,
            title: text.title,
            body: text.body,
            href: `/dashboard/sites/${site.id}`,
        })
        .onConflictDoNothing({ target: [schema.notification.userId, schema.notification.eventKey] });
}

export async function POST(request: Request) {
    const expected = process.env.CONTROLLER_INTERNAL_API_KEY;
    const given = request.headers.get('x-controller-key') || '';
    if (
        !expected ||
        Buffer.byteLength(given) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    )
        return Response.json({ error: 'Unauthorised.' }, { status: 401 });
    let data;
    try {
        data = await request.json();
    } catch {
        return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    if (
        !data ||
        typeof data.site_id !== 'string' ||
        typeof data.user_id !== 'string'
    )
        return Response.json({ error: 'Invalid event.' }, { status: 400 });
    // Fetch authoritative state and ownership rather than trusting event contents.
    try {
        const site = await controller.sites.get(data.site_id, data.user_id);
        await recordSiteNotification(data.user_id, site);
        const appEvent = APP_EVENTS.find((value) => value === data.event);
        if (appEvent) {
            await handleAppResult(site, data.user_id, String(data.app || ''), appEvent);
            return Response.json({ ok: true });
        }
        const event = EVENTS.find((value) => value === data.event);
        if (event) {
            // A late 'milestone' must not announce a site that already finished.
            const stale =
                (event === 'milestone' && site.status === 'ready') ||
                (event === 'ready' && site.status !== 'ready') ||
                (event === 'failed' && site.status === 'ready') ||
                // The customer subscribed before this arrived: no warning or shut-off notice applies any more.
                ((event === 'trial_ending' || event === 'trial_ended') && !site.trial) ||
                (event === 'trial_ending' && site.trial?.expired);
            const user = await db.query.user.findFirst({
                where: eq(schema.user.id, data.user_id),
                columns: { email: true },
            });
            const to = user?.email || site.owner_email;
            if (!stale && to) await sendSiteEmail(event, site, to);
        }
        return Response.json({ ok: true });
    } catch {
        return Response.json(
            { error: 'Event could not be recorded.' },
            { status: 503 },
        );
    }
}
