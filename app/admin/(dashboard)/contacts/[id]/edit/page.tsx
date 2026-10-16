import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { updateContactAction } from '@/app/admin/actions';
import { ContactForm } from '../../contact-form';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const submission = await db.query.contactSubmission.findFirst({ where: eq(schema.contactSubmission.id, id) });

    if (!submission) {
        notFound();
    }

    const boundUpdateAction = updateContactAction.bind(null, submission.id);

    return (
        <div>
            <h1 className="portal-page-title mb-8">Edit Contact</h1>
            <ContactForm
                action={boundUpdateAction}
                submitLabel="Save Changes"
                defaultValues={{
                    firstName: submission.firstName,
                    lastName: submission.lastName,
                    email: submission.email,
                    phone: submission.phone,
                    message: submission.message,
                }}
            />
        </div>
    );
}
