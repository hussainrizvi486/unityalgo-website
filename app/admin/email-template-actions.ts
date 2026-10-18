'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, errorText, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { findEmailEvent, sampleVars } from '@/lib/email-events';
import { renderEmail } from '@/lib/email-render';
import { sendMail } from '@/lib/mail-accounts';

export interface EmailTemplateFormState {
    error?: string;
    success?: string;
}

function readTemplate(formData: FormData) {
    return {
        name: String(formData.get('name') ?? '').trim(),
        subject: String(formData.get('subject') ?? '').trim(),
        bodyHtml: String(formData.get('bodyHtml') ?? '').trim(),
        isActive: formData.get('isActive') === 'on',
    };
}

function validate(fields: ReturnType<typeof readTemplate>) {
    if (!fields.name) return 'A name is required.';
    if (!fields.subject) return 'A subject is required.';
    if (!fields.bodyHtml) return 'The message cannot be empty.';
    if (fields.name.length > 120) return 'The name is too long (120 characters at most).';
    if (fields.subject.length > 300) return 'The subject is too long (300 characters at most).';
    if (fields.bodyHtml.length > 50_000) return 'The message is too long.';
    return null;
}

function friendlyError(error: unknown) {
    if (errorText(error).includes('EmailTemplate_name_key')) return 'A template with that name already exists.';
    return 'Could not save the template. Check the values and try again.';
}

export async function createEmailTemplateAction(_prev: EmailTemplateFormState | undefined, formData: FormData): Promise<EmailTemplateFormState> {
    await requireAdmin();
    const fields = readTemplate(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };
    let id: string;
    try {
        [{ id }] = await db.insert(schema.emailTemplate).values(fields).returning({ id: schema.emailTemplate.id });
    } catch (error) {
        return { error: friendlyError(error) };
    }
    // Assigning it to an event is part of creating it when the form says so.
    const eventKey = String(formData.get('assignTo') ?? '');
    if (eventKey && findEmailEvent(eventKey)) await assign(eventKey, id, true);
    revalidatePath('/admin/email-templates');
    redirect('/admin/email-templates');
}

export async function updateEmailTemplateAction(_prev: EmailTemplateFormState | undefined, formData: FormData): Promise<EmailTemplateFormState> {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return { error: 'Missing template id.' };
    const fields = readTemplate(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };
    try {
        one(await db.update(schema.emailTemplate).set(fields).where(eq(schema.emailTemplate.id, id)).returning({ id: schema.emailTemplate.id }), 'Template');
    } catch (error) {
        return { error: friendlyError(error) };
    }
    revalidatePath('/admin/email-templates');
    redirect('/admin/email-templates');
}

export async function deleteEmailTemplateAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    await db.delete(schema.emailTemplate).where(eq(schema.emailTemplate.id, id));
    revalidatePath('/admin/email-templates');
}

async function assign(eventKey: string, templateId: string | null, enabled: boolean) {
    await db
        .insert(schema.emailEvent)
        .values({ eventKey, templateId, enabled })
        .onConflictDoUpdate({ target: schema.emailEvent.eventKey, set: { templateId, enabled } });
}

export async function assignEmailEventAction(formData: FormData) {
    await requireAdmin();
    const eventKey = String(formData.get('eventKey') ?? '');
    const event = findEmailEvent(eventKey);
    if (!event) return;
    const choice = String(formData.get('templateId') ?? 'default');
    let templateId: string | null = null;
    if (choice !== 'default') {
        const template = await db.query.emailTemplate.findFirst({ where: eq(schema.emailTemplate.id, choice), columns: { id: true } });
        templateId = template?.id ?? null;
    }
    await assign(eventKey, templateId, event.required ? true : formData.get('enabled') === 'on');
    revalidatePath('/admin/email-templates');
}

export async function sendTemplateTestAction(_prev: EmailTemplateFormState | undefined, formData: FormData): Promise<EmailTemplateFormState> {
    await requireAdmin();
    const event = findEmailEvent(String(formData.get('previewEvent') ?? ''));
    const to = String(formData.get('testTo') ?? '').trim();
    if (!event) return { error: 'Choose which event to preview with.' };
    if (!to.includes('@')) return { error: 'Enter an email address to send the test to.' };
    const subject = String(formData.get('subject') ?? '');
    const bodyHtml = String(formData.get('bodyHtml') ?? '');
    if (!subject.trim() || !bodyHtml.trim()) return { error: 'Write a subject and a message first.' };
    try {
        const message = renderEmail({ subject: `[Test] ${subject}`, bodyHtml }, sampleVars(event));
        await sendMail(event.purpose, { to, subject: message.subject, text: message.text, html: message.html });
        return { success: `Test message sent to ${to}, filled with sample values.` };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'The test message could not be sent.' };
    }
}
