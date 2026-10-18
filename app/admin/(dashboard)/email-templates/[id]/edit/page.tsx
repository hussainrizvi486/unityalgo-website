import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { updateEmailTemplateAction } from '@/app/admin/email-template-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmailTemplateForm } from '../../template-form';

export const metadata = { title: 'Edit email template' };

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;
    const template = await db.query.emailTemplate.findFirst({ where: eq(schema.emailTemplate.id, id) });
    if (!template) notFound();
    const assigned = await db.query.emailEvent.findFirst({ where: eq(schema.emailEvent.templateId, id), columns: { eventKey: true } });
    return (
        <div>
            <AdminPageHeader title={`Edit “${template.name}”`} />
            <EmailTemplateForm
                action={updateEmailTemplateAction}
                submitLabel="Save changes"
                defaultValues={{ id: template.id, name: template.name, subject: template.subject, bodyHtml: template.bodyHtml, isActive: template.isActive, previewEvent: assigned?.eventKey }}
            />
        </div>
    );
}
