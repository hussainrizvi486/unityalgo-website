import { prisma } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDateTime } from '@/lib/admin-format';
import { AdminPageHeader } from '@/components/admin/page-header';
import { deleteContactSubmissionAction } from '@/app/admin/actions';
import { ContactsList, type ContactRow } from './contacts-list';

export default async function AdminContactsPage() {
    const [submissions, totalCount] = await Promise.all([
        prisma.contactSubmission.findMany({
            orderBy: { createdAt: 'desc' },
            take: ADMIN_LIST_LIMIT,
        }),
        prisma.contactSubmission.count(),
    ]);

    const rows: ContactRow[] = submissions.map((submission) => ({
        id: submission.id,
        name: `${submission.firstName} ${submission.lastName}`.trim(),
        email: submission.email,
        phone: submission.phone,
        message: submission.message,
        received: formatDateTime(submission.createdAt),
    }));

    return (
        <div>
            <AdminPageHeader
                title="Contacts"
                subtitle={
                    rows.length < totalCount
                        ? `Showing the ${rows.length} most recent of ${totalCount}`
                        : `${totalCount} total`
                }
                action={{ label: 'New Contact', href: '/admin/contacts/new' }}
            />
            <ContactsList rows={rows} deleteAction={deleteContactSubmissionAction} />
        </div>
    );
}
