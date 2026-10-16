import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { updateEmailAccountAction } from '@/app/admin/email-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmailAccountForm } from '../../email-account-form';

export default async function EditEmailAccountPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;

    // Password columns are deliberately not selected: the form shows a blank
    // field meaning "unchanged", so the stored secret never has to travel.
    // Passwords are deliberately not selected: the form's password field means "unchanged" when blank.
    const account = await db.query.emailAccount.findFirst({
        where: eq(schema.emailAccount.id, id),
        columns: {
            id: true, label: true, address: true, fromName: true, purpose: true,
            smtpHost: true, smtpPort: true, smtpSecure: true, smtpUsername: true,
            imapHost: true, imapPort: true, imapSecure: true, imapUsername: true,
            isDefault: true, isActive: true,
        },
    });
    if (!account) notFound();

    return (
        <div>
            <AdminPageHeader
                title={`Edit ${account.label}`}
                subtitle={account.address}
            />
            <EmailAccountForm
                action={updateEmailAccountAction}
                submitLabel="Save changes"
                isEdit
                defaultValues={{
                    id: account.id,
                    label: account.label,
                    address: account.address,
                    fromName: account.fromName ?? '',
                    purpose: account.purpose,
                    smtpHost: account.smtpHost,
                    smtpPort: String(account.smtpPort),
                    smtpSecure: account.smtpSecure,
                    smtpUsername: account.smtpUsername,
                    imapHost: account.imapHost ?? '',
                    imapPort: account.imapPort == null ? '993' : String(account.imapPort),
                    imapSecure: account.imapSecure,
                    imapUsername: account.imapUsername ?? '',
                    isDefault: account.isDefault,
                    isActive: account.isActive,
                }}
            />
        </div>
    );
}
