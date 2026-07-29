import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminPagination } from '@/components/admin/pagination';
import { ADMIN_PAGE_SIZE, parsePage, totalPagesFor } from '@/lib/pagination';
import { deleteContactSubmissionAction } from '@/app/admin/actions';

interface ContactsPageProps {
    searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminContactsPage({ searchParams }: ContactsPageProps) {
    const params = await searchParams;
    const currentPage = parsePage(params.page);
    const q = params.q?.trim() ?? '';

    const where: Prisma.ContactSubmissionWhereInput = q
        ? {
              OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
              ],
          }
        : {};

    const [submissions, totalCount] = await Promise.all([
        prisma.contactSubmission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
            take: ADMIN_PAGE_SIZE,
        }),
        prisma.contactSubmission.count({ where }),
    ]);

    const totalPages = totalPagesFor(totalCount);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Contacts</h1>
                    <p className="text-sm text-gray-500 mt-1">{totalCount} total</p>
                </div>
                <Link href="/admin/contacts/new">
                    <Button className="rounded-full bg-brand-600 hover:bg-brand-700 text-white">New Contact</Button>
                </Link>
            </div>

            <form className="flex flex-wrap items-end gap-3 mb-6">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
                    <Input name="q" defaultValue={q} placeholder="Search by name or email…" />
                </div>
                <Button type="submit" variant="outline" className="rounded-md">
                    Filter
                </Button>
                {q && (
                    <Link href="/admin/contacts" className="text-sm text-gray-500 hover:text-gray-700 mb-2">
                        Clear
                    </Link>
                )}
            </form>

            {submissions.length === 0 ? (
                <p className="text-gray-500 text-center py-20">No contact form submissions found.</p>
            ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wide">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Message</th>
                                <th className="px-6 py-4">Received</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {submissions.map((submission) => (
                                <tr key={submission.id} className="align-top">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">
                                            {submission.firstName} {submission.lastName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div>{submission.email}</div>
                                        <div className="text-gray-400 text-xs">{submission.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 max-w-md">
                                        <p className="line-clamp-3">{submission.message}</p>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                                            submission.createdAt
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/contacts/${submission.id}/edit`}>
                                                <Button size="sm" variant="outline" className="rounded-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <form action={deleteContactSubmissionAction}>
                                                <input type="hidden" name="id" value={submission.id} />
                                                <Button size="sm" variant="destructive" className="rounded-full" type="submit">
                                                    Delete
                                                </Button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminPagination
                basePath="/admin/contacts"
                currentPage={currentPage}
                totalPages={totalPages}
                searchParams={{ q }}
            />
        </div>
    );
}
