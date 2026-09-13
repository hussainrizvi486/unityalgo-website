import { requireAdmin } from '@/lib/admin-session';
import { createEmailAccountAction } from '@/app/admin/email-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmailAccountForm } from '../email-account-form';

export default async function NewEmailAccountPage() {
    await requireAdmin();
    return (
        <div>
            <AdminPageHeader
                title="Add email account"
                subtitle="Credentials are encrypted before they are stored and are never sent back to the browser."
            />
            <EmailAccountForm action={createEmailAccountAction} submitLabel="Add account" />
        </div>
    );
}
