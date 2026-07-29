import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { updateContactAction } from '@/app/admin/actions';
import { ContactForm } from '../../contact-form';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const submission = await prisma.contactSubmission.findUnique({ where: { id } });

    if (!submission) {
        notFound();
    }

    const boundUpdateAction = updateContactAction.bind(null, submission.id);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-8">Edit Contact</h1>
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
