'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { encryptSecret } from '@/lib/secret-box';
import { buildSmtpTransport } from '@/lib/mail-accounts';
import type { EmailPurpose } from '@prisma/client';

/**
 * Admin actions for mail accounts.
 *
 * Two rules hold throughout: every action re-checks the admin session rather
 * than trusting the page that rendered the form, and no password ever travels
 * back to the browser. A blank password field on an edit means "keep what is
 * stored", which is the only way to offer editing without round-tripping the
 * secret.
 */

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
        // Incoming is optional; a blank host clears the whole IMAP block,
        // which the table's CHECK constraint requires to be all-or-nothing.
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

/**
 * Clears the previous default in the same transaction that sets the new one.
 *
 * The partial unique index would otherwise reject the write, and doing both
 * halves separately leaves a window with two defaults or none.
 */
async function withDefaultCleared<T>(isDefault: boolean, keepId: string | null, work: () => Promise<T>) {
    if (!isDefault) return work();
    return prisma.$transaction(async (tx) => {
        await tx.emailAccount.updateMany({
            where: { isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
            data: { isDefault: false },
        });
        return work();
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
        await withDefaultCleared(fields.isDefault, null, () =>
            prisma.emailAccount.create({
                data: {
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
                },
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
        await withDefaultCleared(fields.isDefault, id, () =>
            prisma.emailAccount.update({
                where: { id },
                data: {
                    label: fields.label,
                    address: fields.address,
                    fromName: fields.fromName,
                    purpose: fields.purpose,
                    smtpHost: fields.smtpHost,
                    smtpPort: fields.smtpPort,
                    smtpSecure: fields.smtpSecure,
                    smtpUsername: fields.smtpUsername,
                    // Blank means "unchanged" — the form never receives the
                    // stored password, so it cannot send it back.
                    ...(fields.smtpPassword ? { smtpPassword: encryptSecret(fields.smtpPassword) } : {}),
                    imapHost: fields.imapHost,
                    imapPort: fields.imapPort,
                    imapSecure: fields.imapSecure,
                    imapUsername: fields.imapUsername,
                    ...(fields.imapHost
                        ? (fields.imapPassword ? { imapPassword: encryptSecret(fields.imapPassword) } : {})
                        // Clearing the host clears the credentials with it, or
                        // the all-or-nothing CHECK constraint rejects the row.
                        : { imapPassword: null }),
                    isDefault: fields.isDefault,
                    isActive: fields.isActive,
                },
            }));
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
    await prisma.emailAccount.delete({ where: { id } });
    revalidatePath('/admin/email-accounts');
}

/**
 * Dials the account's SMTP server and records the result.
 *
 * `verify()` completes the greeting, TLS negotiation and authentication without
 * sending anything, which is exactly the part that goes wrong — a wrong port or
 * a wrong `secure` flag otherwise surfaces as mail silently not arriving much
 * later.
 */
export async function testEmailAccountAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const account = await prisma.emailAccount.findUnique({ where: { id } });
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

    await prisma.emailAccount.update({
        where: { id },
        data: { lastTestedAt: new Date(), lastTestOk: ok, lastTestError: ok ? null : message },
    });
    revalidatePath('/admin/email-accounts');
}

function friendlyError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes('EmailAccount_address_key')) {
        return 'An account already exists for that address.';
    }
    if (text.includes('CREDENTIAL_ENCRYPTION_KEY')) return text;
    return 'Could not save the account. Check the values and try again.';
}
