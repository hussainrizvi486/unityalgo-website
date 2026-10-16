import { emailStyle } from '@/lib/email-theme';
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { sendMail } from '@/lib/mail-accounts';
import type { CustomerSite } from '@/lib/controller-client';

export type SiteEmailEvent =
    | 'initiated'
    | 'started'
    | 'milestone'
    | 'ready'
    | 'failed';

const PORTAL_URL = (
    process.env.PLATFORM_PUBLIC_URL || 'https://www.unityalgo.com'
).replace(/\/$/, '');

const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );

function compose(event: SiteEmailEvent, site: CustomerSite) {
    const detailsUrl = `${PORTAL_URL}/dashboard/sites/${site.id}`;
    const siteUrl = `https://${site.domain}`;
    switch (event) {
        case 'initiated':
            return {
                subject: `We received your request for ${site.name}`,
                lead: `Your ERP site request for ${site.name} (${site.domain}) has been received.`,
                status: 'Site creation initiated',
                next: 'Nothing else is needed. We will email you when deployment starts and when the site is ready.',
                cta: ['Track progress', detailsUrl],
            };
        case 'started':
            return {
                subject: `Deployment started for ${site.name}`,
                lead: `A server has been assigned and deployment of ${site.name} has begun.`,
                status: 'Deployment started',
                next: 'This usually takes several minutes. You can follow each step on your site page.',
                cta: ['View progress', detailsUrl],
            };
        case 'milestone':
            return {
                subject: `${site.name} is being installed`,
                lead: `Servers are ready and ERPNext is now being installed and configured for ${site.name}.`,
                status: 'Installing ERPNext and setting up your company',
                next: 'The longest step is underway. Final checks and HTTPS routing follow.',
                cta: ['View progress', detailsUrl],
            };
        case 'ready':
            return {
                subject: `${site.name} is ready`,
                lead: `Your ERP site is live at ${site.domain}.`,
                status: 'Deployment completed successfully',
                next: `Sign in with ${site.owner_email ?? 'the email you registered'} and the password you chose during setup.`,
                cta: ['Open your ERP site', siteUrl],
            };
        case 'failed':
            return {
                subject: `${site.name} could not be deployed`,
                lead: `Deployment of ${site.name} (${site.domain}) did not complete.`,
                status: 'Deployment failed',
                next: `${site.error ? site.error + ' ' : ''}Open your site page to retry. If it fails again, reply to this email or contact support.`,
                cta: ['Review and retry', detailsUrl],
            };
    }
}

function render(event: SiteEmailEvent, site: CustomerSite) {
    const c = compose(event, site);
    const text = `${c.lead}\n\nStatus: ${c.status}\n\n${c.next}\n\n${c.cta[0]}: ${c.cta[1]}\n\nSite: ${site.name}\nAddress: ${site.domain}${site.plan_name ? `\nPlan: ${site.plan_name}` : ''}`;
    const html = `
<div style="${emailStyle.page}">
  <p>${escapeHtml(c.lead)}</p>
  <p style="${emailStyle.callout}"><strong>${escapeHtml(c.status)}</strong></p>
  <p style="line-height: 1.6;">${escapeHtml(c.next)}</p>
  <p style="margin: calc(${emailStyle.gap} * 1.5) 0;"><a href="${escapeHtml(c.cta[1])}" style="${emailStyle.button}">${escapeHtml(c.cta[0])}</a></p>
  <p style="${emailStyle.muted}">Site: ${escapeHtml(site.name)}<br/>Address: ${escapeHtml(site.domain)}${site.plan_name ? `<br/>Plan: ${escapeHtml(site.plan_name)}` : ''}</p>
</div>`;
    return { subject: c.subject, text, html };
}

/**
 * Sends a lifecycle email once per (site, event). The claim row is written
 * first so a redelivered event cannot double-send; if sending fails the claim
 * is released and the error propagates so the controller retries.
 */
export async function sendSiteEmail(
    event: SiteEmailEvent,
    site: CustomerSite,
    to: string,
) {
    // One email per event per provisioning attempt. The attempt number is stable, unlike the
    // update time, so a redelivered event never sends twice but a retry still gets its own emails.
    const eventKey = event === 'initiated' ? event : `${event}:${site.attempt}`;
    const claim = { siteId: site.id, eventKey };
    // The unique (siteId, eventKey) row is the claim: when it already exists, another delivery got there first.
    const claimed = await db.insert(schema.siteEmailEvent).values(claim).onConflictDoNothing().returning({ id: schema.siteEmailEvent.id });
    if (claimed.length === 0) return false;
    try {
        await sendMail('TRANSACTIONAL', { to, ...render(event, site) });
        return true;
    } catch (error) {
        await db
            .delete(schema.siteEmailEvent)
            .where(and(eq(schema.siteEmailEvent.siteId, claim.siteId), eq(schema.siteEmailEvent.eventKey, claim.eventKey)));
        throw error;
    }
}
