import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { sendMail } from '@/lib/mail-accounts';
import { findEmailEvent } from '@/lib/email-events';
import { renderEmail, type EmailVars } from '@/lib/email-render';

export const PORTAL_URL = (process.env.PLATFORM_PUBLIC_URL || 'https://www.unityalgo.com').replace(/\/$/, '');

/** Values every message can use. */
const platformVars = (): EmailVars => ({ 'platform.name': process.env.PLATFORM_NAME || 'UnityAlgo', 'platform.url': PORTAL_URL });

export async function resolveEventMessage(eventKey: string) {
    const event = findEmailEvent(eventKey);
    if (!event) throw new Error(`Unknown email event "${eventKey}".`);
    const setup = await db.query.emailEvent.findFirst({ where: eq(schema.emailEvent.eventKey, eventKey) });
    const enabled = event.required || (setup ? setup.enabled : event.defaultEnabled);
    if (!enabled) return null;
    const assigned = setup?.templateId
        ? await db.query.emailTemplate.findFirst({ where: and(eq(schema.emailTemplate.id, setup.templateId), eq(schema.emailTemplate.isActive, true)) })
        : null;
    return {
        event,
        template: assigned ?? { subject: event.defaultSubject, bodyHtml: event.defaultBody },
        templateId: assigned?.id ?? null,
    };
}

export async function sendEventEmail(eventKey: string, to: string, vars: EmailVars): Promise<{ sent: boolean; reason?: string }> {
    const message = await resolveEventMessage(eventKey);
    if (!message) return { sent: false, reason: 'disabled' };
    const rendered = renderEmail(message.template, { ...platformVars(), ...vars });
    await sendMail(message.event.purpose, { to, subject: rendered.subject, text: rendered.text, html: rendered.html });
    return { sent: true };
}
