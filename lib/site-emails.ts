import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { PORTAL_URL, sendEventEmail } from '@/lib/email-templates';
import type { CustomerSite } from '@/lib/controller-client';

export type SiteEmailEvent =
    | 'initiated'
    | 'started'
    | 'milestone'
    | 'ready'
    | 'failed'
    | 'trial_ending'
    | 'trial_ended'
    | 'trial_converted';

export type AppEmailEvent = 'app_installed' | 'app_failed' | 'app_removed' | 'app_removal_failed';

async function siteVars(site: CustomerSite, to: string) {
    const customer = await db.query.user.findFirst({
        where: eq(schema.user.email, to),
        columns: { name: true, firstName: true, lastName: true },
    });
    const days = site.trial?.days_left ?? 0;
    return {
        'user.email': to,
        'user.name': customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || to,
        'site.name': site.name,
        'site.domain': site.domain,
        'site.url': site.url,
        'site.details_url': `${PORTAL_URL}/dashboard/sites/${site.id}`,
        'site.plan': site.plan_name ?? 'Not set',
        'site.owner_email': site.owner_email ?? 'the email you registered',
        'site.status': site.status,
        'site.error': site.error ?? '',
        'trial.days_left': String(days),
        'trial.days_left_text': `${days} day${days === 1 ? '' : 's'}`,
        'trial.ends_at': site.trial ? new Date(site.trial.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        plans_url: `${PORTAL_URL}/dashboard/plans`,
    };
}

async function once(siteId: string, eventKey: string, send: () => Promise<boolean>) {
    const claimed = await db.insert(schema.siteEmailEvent).values({ siteId, eventKey }).onConflictDoNothing().returning({ id: schema.siteEmailEvent.id });
    if (claimed.length === 0) return false;
    try {
        return await send();
    } catch (error) {
        await db
            .delete(schema.siteEmailEvent)
            .where(and(eq(schema.siteEmailEvent.siteId, siteId), eq(schema.siteEmailEvent.eventKey, eventKey)));
        throw error;
    }
}

export async function sendSiteEmail(event: SiteEmailEvent, site: CustomerSite, to: string) {
    const claimKey = event === 'initiated'
        ? event
        : event === 'trial_ending' || event === 'trial_ended'
            ? `${event}:${site.trial?.ends_at ?? site.attempt}`
            : `${event}:${site.attempt}`;
    return once(site.id, claimKey, async () => (await sendEventEmail(`site_${event}`, to, await siteVars(site, to))).sent);
}

export async function sendAppEmail(event: AppEmailEvent, site: CustomerSite, to: string, app: { name: string; detail: string }) {
    return once(site.id, `${event}:${app.name}:${site.updated_at}`, async () =>
        (await sendEventEmail(event, to, { ...(await siteVars(site, to)), 'app.name': app.name, 'app.detail': app.detail })).sent);
}
