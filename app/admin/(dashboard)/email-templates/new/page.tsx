import { requireAdmin } from '@/lib/admin-session';
import { createEmailTemplateAction } from '@/app/admin/email-template-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmailTemplateForm } from '../template-form';

export const metadata = { title: 'New email template' };

export default async function NewEmailTemplatePage() {
    await requireAdmin();
    return (
        <div>
            <AdminPageHeader title="New email template" subtitle="Write the message once; placeholders are filled in with each customer's own details when it is sent." />
            <EmailTemplateForm action={createEmailTemplateAction} submitLabel="Create template" defaultValues={{ isActive: true }} />
        </div>
    );
}
