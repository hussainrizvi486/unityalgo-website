'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';
import { db, errorText, one, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { encryptSecret } from '@/lib/secret-box';
import { buildSmtpTransport } from '@/lib/mail-accounts';
import type { EmailPurpose } from '@/db/types';

export interface EmailAccountFormState {
    error?: string;
    success?: string;
}

const PURPOSES: EmailPurpose[] = ['TRANSACTIONAL', 'SUPPORT', 'BILLING', 'MARKETING'];

function readFields(formData: FormData) {
    const purposeRaw = String(formData.get('purpose') ?? 'TRANSACTIONAL') as EmailPurpose;
    const imapHost = String(formData.get('imapHost') ?? '').trim();
    return {
        label: String(formData.get('label') ?? '').trim(),
        address: String(formData.get('address') ?? '').trim().toLowerCase(),
        fromName: String(formData.get('fromName') ?? '').trim() || null,
        purpose: PURPOSES.includes(purposeRaw) ? purposeRaw : ('TRANSACTIONAL' as EmailPurpose),
        smtpHost: String(formData.get('smtpHost') ?? '').trim(),
        smtpPort: Number(formData.get('smtpPort') ?? 587),
        smtpSecure: formData.get('smtpSecure') === 'on',
        smtpUsername: String(formData.get('smtpUsername') ?? '').trim(),
        smtpPassword: String(formData.get('smtpPassword') ?? ''),
        imapHost: imapHost || null,
        imapPort: imapHost ? Number(formData.get('imapPort') ?? 993) : null,
        imapSecure: formData.get('imapSecure') === 'on',
        imapUsername: imapHost ? String(formData.get('imapUsername') ?? '').trim() : null,
        imapPassword: String(formData.get('imapPassword') ?? ''),
        isDefault: formData.get('isDefault') === 'on',
        isActive: formData.get('isActive') === 'on',
    };
}

function validate(fields: ReturnType<typeof readFields>) {
    if (!fields.label) return 'A label is required.';
    if (!fields.address || !fields.address.includes('@')) return 'A valid email address is required.';
    if (!fields.smtpHost) return 'An SMTP host is required.';
    if (!fields.smtpUsername) return 'An SMTP username is required.';
    if (!Number.isInteger(fields.smtpPort) || fields.smtpPort < 1 || fields.smtpPort > 65535) {
        return 'SMTP port must be between 1 and 65535.';
    }
    if (fields.imapHost) {
        if (!fields.imapUsername) return 'An IMAP username is required when an IMAP host is set.';
        if (!Number.isInteger(fields.imapPort!) || fields.imapPort! < 1 || fields.imapPort! > 65535) {
            return 'IMAP port must be between 1 and 65535.';
        }
    }
    return null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function withDefaultCleared<T>(isDefault: boolean, keepId: string | null, work: (tx: Tx | typeof db) => Promise<T>) {
    if (!isDefault) return work(db);
    return db.transaction(async (tx) => {
        await tx
            .update(schema.emailAccount)
            .set({ isDefault: false })
            .where(and(eq(schema.emailAccount.isDefault, true), keepId ? ne(schema.emailAccount.id, keepId) : undefined));
        return work(tx);
    });
}

export async function createEmailAccountAction(
    _prev: EmailAccountFormState | undefined,
    formData: FormData,
): Promise<EmailAccountFormState> {
    await requireAdmin();
    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };
    if (!fields.smtpPassword) return { error: 'An SMTP password is required.' };
    if (fields.imapHost && !fields.imapPassword) {
        return { error: 'An IMAP password is required when an IMAP host is set.' };
    }

    try {
        await withDefaultCleared(fields.isDefault, null, (tx) =>
            tx.insert(schema.emailAccount).values({
                    label: fields.label,
                    address: fields.address,
                    fromName: fields.fromName,
                    purpose: fields.purpose,
                    smtpHost: fields.smtpHost,
                    smtpPort: fields.smtpPort,
                    smtpSecure: fields.smtpSecure,
                    smtpUsername: fields.smtpUsername,
                    smtpPassword: encryptSecret(fields.smtpPassword),
                    imapHost: fields.imapHost,
                    imapPort: fields.imapPort,
                    imapSecure: fields.imapSecure,
                    imapUsername: fields.imapUsername,
                    imapPassword: fields.imapHost ? encryptSecret(fields.imapPassword) : null,
                    isDefault: fields.isDefault,
                    isActive: fields.isActive,
            }));
    } catch (error) {
        return { error: friendlyError(error) };
    }

    revalidatePath('/admin/email-accounts');
    redirect('/admin/email-accounts');
}

export async function updateEmailAccountAction(
    _prev: EmailAccountFormState | undefined,
    formData: FormData,
): Promise<EmailAccountFormState> {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return { error: 'Missing account id.' };

    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };

    try {
        await withDefaultCleared(fields.isDefault, id, async (tx) =>
            one(await tx.update(schema.emailAccount).set({
                    label: fields.label,
                    address: fields.address,
                    fromName: fields.fromName,
                    purpose: fields.purpose,
                    smtpHost: fields.smtpHost,
                    smtpPort: fields.smtpPort,
                    smtpSecure: fields.smtpSecure,
                    smtpUsername: fields.smtpUsername,
                    ...(fields.smtpPassword ? { smtpPassword: encryptSecret(fields.smtpPassword) } : {}),
                    imapHost: fields.imapHost,
                    imapPort: fields.imapPort,
                    imapSecure: fields.imapSecure,
                    imapUsername: fields.imapUsername,
                    ...(fields.imapHost
                        ? (fields.imapPassword ? { imapPassword: encryptSecret(fields.imapPassword) } : {})
                        : { imapPassword: null }),
                    isDefault: fields.isDefault,
                    isActive: fields.isActive,
            }).where(eq(schema.emailAccount.id, id)).returning({ id: schema.emailAccount.id }), 'Email account'));
    } catch (error) {
        return { error: friendlyError(error) };
    }

    revalidatePath('/admin/email-accounts');
    redirect('/admin/email-accounts');
}

export async function deleteEmailAccountAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    await db.delete(schema.emailAccount).where(eq(schema.emailAccount.id, id));
    revalidatePath('/admin/email-accounts');
}

export async function testEmailAccountAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const account = await db.query.emailAccount.findFirst({ where: eq(schema.emailAccount.id, id) });
    if (!account) return;

    let ok = false;
    let message: string | null = null;
    try {
        const { decryptSecret } = await import('@/lib/secret-box');
        const transport = buildSmtpTransport({
            host: account.smtpHost,
            port: account.smtpPort,
            secure: account.smtpSecure,
            username: account.smtpUsername,
            password: decryptSecret(account.smtpPassword),
        });
        await transport.verify();
        transport.close();
        ok = true;
    } catch (error) {
        message = error instanceof Error ? error.message : String(error);
    }

    await db
        .update(schema.emailAccount)
        .set({ lastTestedAt: new Date(), lastTestOk: ok, lastTestError: ok ? null : message })
        .where(eq(schema.emailAccount.id, id));
    revalidatePath('/admin/email-accounts');
}

export async function testSmtpSettingsAction(
    _prev: EmailAccountFormState | undefined,
    formData: FormData,
): Promise<EmailAccountFormState> {
    await requireAdmin();
    const fields = readFields(formData);
    if (!fields.smtpHost) return { error: 'Enter an SMTP host to test.' };
    if (!fields.smtpUsername) return { error: 'Enter an SMTP username to test.' };
    if (!Number.isInteger(fields.smtpPort) || fields.smtpPort < 1 || fields.smtpPort > 65535) {
        return { error: 'SMTP port must be between 1 and 65535.' };
    }

    let password = fields.smtpPassword;
    const id = String(formData.get('id') ?? '');
    if (!password && id) {
        const stored = await db.query.emailAccount.findFirst({ where: eq(schema.emailAccount.id, id), columns: { smtpPassword: true } });
        if (stored) {
            const { decryptSecret } = await import('@/lib/secret-box');
            password = decryptSecret(stored.smtpPassword);
        }
    }
    if (!password) return { error: 'Enter the SMTP password to test.' };

    const transport = buildSmtpTransport({
        host: fields.smtpHost, port: fields.smtpPort, secure: fields.smtpSecure, username: fields.smtpUsername, password,
    });
    try {
        await transport.verify();
        const to = String(formData.get('testTo') ?? '').trim();
        if (!to) return { success: `Connected to ${fields.smtpHost}:${fields.smtpPort} and signed in as ${fields.smtpUsername}.` };
        if (!to.includes('@')) return { error: 'The test recipient is not a valid email address.' };
        const from = fields.fromName ? `"${fields.fromName.replace(/"/g, '')}" <${fields.address || fields.smtpUsername}>` : (fields.address || fields.smtpUsername);
        await transport.sendMail({
            from,
            to,
            subject: 'SMTP test from UnityAlgo',
            text: 'This is a test message. If you can read it, these SMTP settings work.',
        });
        return { success: `Connected, signed in and sent a test message to ${to}.` };
    } catch (error) {
        return { error: friendlySmtpError(error) };
    } finally {
        transport.close();
    }
}

function friendlySmtpError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string } | null)?.code;
    if (code === 'EAUTH' || /invalid login|authentication/i.test(message)) return `The server rejected the username or password. ${message}`;
    if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(message)) return `Nothing is accepting connections at that host and port. Check the host and port. ${message}`;
    if (code === 'ENOTFOUND' || /ENOTFOUND/.test(message)) return `The host name could not be found. Check the SMTP host. ${message}`;
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /greeting|timeout/i.test(message)) {
        return `The server did not answer as expected. Port 465 needs "Implicit TLS" on; ports 587 and 25 need it off. ${message}`;
    }
    return message;
}

function friendlyError(error: unknown) {
    const text = errorText(error);
    if (text.includes('EmailAccount_address_key')) {
        return 'An account already exists for that address.';
    }
    if (text.includes('CREDENTIAL_ENCRYPTION_KEY')) return text;
    return 'Could not save the account. Check the values and try again.';
}
