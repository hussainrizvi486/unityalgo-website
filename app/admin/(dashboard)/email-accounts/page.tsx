import { asc, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { encryptionIsConfigured } from '@/lib/secret-box';
import { getEmailDeliveryWarning } from '@/lib/email-delivery';
import { deleteEmailAccountAction, testEmailAccountAction } from '@/app/admin/email-actions';
import { AdminPageHeader, AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { EmailAccountsList, type EmailAccountRow } from './email-accounts-list';

/**
 * Mail accounts the platform sends from.
 *
 * Passwords are never selected here. The list needs host, port and status; the
 * ciphertext has no business leaving the database for a page render.
 */
export default async function AdminEmailAccountsPage() {
    await requireAdmin();

    const accounts = await db.query.emailAccount.findMany({
        columns: {
            id: true, label: true, address: true, purpose: true, createdAt: true,
            smtpHost: true, smtpPort: true, smtpSecure: true,
            imapHost: true, imapPort: true,
            isDefault: true, isActive: true,
            lastTestedAt: true, lastTestOk: true, lastTestError: true,
        },
        orderBy: [desc(schema.emailAccount.isDefault), asc(schema.emailAccount.label)],
    });

    const rows: EmailAccountRow[] = accounts.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        purpose: a.purpose,
        smtp: `${a.smtpHost}:${a.smtpPort}${a.smtpSecure ? ' TLS' : ' STARTTLS'}`,
        imap: a.imapHost ? `${a.imapHost}:${a.imapPort ?? 993}` : null,
        isDefault: a.isDefault,
        isActive: a.isActive,
        testStatus: a.lastTestedAt == null
            ? 'Not tested'
            : a.lastTestOk
                ? `OK · ${a.lastTestedAt.toLocaleDateString()}`
                : 'Failed',
        testOk: a.lastTestedAt == null ? null : a.lastTestOk,
    }));

    const failing = accounts.filter((a) => a.lastTestOk === false);
    const hasDefault = accounts.some((a) => a.isDefault && a.isActive);
    const verificationAccount = accounts.filter((a) => a.isActive && a.purpose === 'TRANSACTIONAL')
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.getTime() - b.createdAt.getTime())[0]
        ?? accounts.find((a) => a.isActive && a.isDefault);
    const environmentConfigured = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']
        .every((key) => Boolean(process.env[key]));
    const deliveryWarning = verificationAccount
        ? await getEmailDeliveryWarning(verificationAccount.smtpHost, verificationAccount.address)
        : environmentConfigured
            ? await getEmailDeliveryWarning(process.env.SMTP_HOST!, process.env.SMTP_FROM || process.env.SMTP_USER!)
            : null;

    return (
        <div>
            <AdminPageHeader
                title="Email accounts"
                subtitle="Mailboxes the platform sends from. Mail is routed by purpose, falling back to the default account."
                action={{ label: 'Add account', href: '/admin/email-accounts/new' }}
            />

            {!encryptionIsConfigured() ? (
                <AdminPageError message="CREDENTIAL_ENCRYPTION_KEY is not set, so passwords cannot be stored. Generate one with `openssl rand -base64 32` and add it to .env." />
            ) : null}

            {!verificationAccount ? (
                environmentConfigured
                    ? <AdminPageNotice message="Registration verification codes use the SMTP_* environment mailbox. No active transactional or default account is configured here." />
                    : <AdminPageError message="Registration emails cannot be sent: configure an active transactional email account or the SMTP_* environment variables." />
            ) : null}

            {deliveryWarning ? <AdminPageError message={deliveryWarning} /> : null}

            {accounts.length > 0 && !hasDefault ? (
                <AdminPageNotice message="No active default account. Any purpose without its own mailbox falls through to the SMTP_* environment variables." />
            ) : null}

            {failing.length > 0 ? (
                <AdminPageError message={`${failing.length} account${failing.length > 1 ? 's' : ''} failed the last connection test: ${failing[0].lastTestError ?? 'unknown error'}`} />
            ) : null}

            <EmailAccountsList
                rows={rows}
                testAction={testEmailAccountAction}
                deleteAction={deleteEmailAccountAction}
            />
        </div>
    );
}
