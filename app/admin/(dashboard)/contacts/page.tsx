import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AdminPagination } from '@/components/admin/pagination';
import { DeleteButton } from '@/components/admin/delete-button';
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
                    <p className="text-sm text-ink-500 mt-1">{totalCount} total</p>
                </div>
                <Link href="/admin/contacts/new">
                    <Button className="rounded-full bg-brand hover:brightness-90 text-white">New Contact</Button>
                </Link>
            </div>

            <form className="flex flex-wrap items-end gap-3 mb-6">
                <div className="flex-1 min-w-48">
                    <Label htmlFor="q" className="text-xs text-ink-500 mb-1.5">Search</Label>
                    <Input id="q" name="q" defaultValue={q} placeholder="Search by name or email…" />
                </div>
                <Button type="submit" variant="outline" className="rounded-md">
                    Filter
                </Button>
                {q && (
                    <Link href="/admin/contacts" className="text-sm text-ink-500 hover:text-ink-700 mb-2">
                        Clear
                    </Link>
                )}
            </form>

            {submissions.length === 0 ? (
                <p className="text-ink-500 text-center py-20">No contact form submissions found.</p>
            ) : (
                <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-ink-50 text-ink-500 uppercase text-xs tracking-wide">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="px-6 py-4">Name</TableHead>
                                <TableHead className="px-6 py-4">Contact</TableHead>
                                <TableHead className="px-6 py-4">Message</TableHead>
                                <TableHead className="px-6 py-4">Received</TableHead>
                                <TableHead className="px-6 py-4 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-ink-100">
                            {submissions.map((submission) => (
                                <TableRow key={submission.id} className="align-top">
                                    <TableCell className="px-6 py-4 whitespace-normal">
                                        <div className="font-medium text-ink-900">
                                            {submission.firstName} {submission.lastName}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-ink-600 whitespace-normal">
                                        <div>{submission.email}</div>
                                        <div className="text-ink-400 text-xs">{submission.phone}</div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-ink-600 max-w-md whitespace-normal">
                                        <p className="line-clamp-3">{submission.message}</p>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-ink-500 whitespace-nowrap">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                                            submission.createdAt
                                        )}
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/contacts/${submission.id}/edit`}>
                                                <Button size="sm" variant="outline" className="rounded-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <DeleteButton
                                                action={deleteContactSubmissionAction}
                                                id={submission.id}
                                                title="Delete this submission?"
                                                description={`The message from "${submission.firstName} ${submission.lastName}" will be permanently deleted.`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
