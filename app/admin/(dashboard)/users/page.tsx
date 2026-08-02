import Link from 'next/link';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AdminPagination } from '@/components/admin/pagination';
import { DeleteButton } from '@/components/admin/delete-button';
import { ADMIN_PAGE_SIZE, parsePage, totalPagesFor } from '@/lib/pagination';
import { deleteUserAction } from '@/app/admin/actions';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

interface UsersPageProps {
    searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
    const params = await searchParams;
    const currentPage = parsePage(params.page);
    const q = params.q?.trim() ?? '';

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

    const where: Prisma.AdminUserWhereInput = q
        ? {
              OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { name: { contains: q, mode: 'insensitive' } },
              ],
          }
        : {};

    const [users, totalCount] = await Promise.all([
        prisma.adminUser.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
            take: ADMIN_PAGE_SIZE,
        }),
        prisma.adminUser.count({ where }),
    ]);

    const totalPages = totalPagesFor(totalCount);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Users</h1>
                    <p className="text-sm text-ink-500 mt-1">{totalCount} total</p>
                </div>
                <Link href="/admin/users/new">
                    <Button className="rounded-full bg-brand hover:brightness-90 text-white">New User</Button>
                </Link>
            </div>

            {params.error && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-error-50 text-error-700 text-sm">{params.error}</div>
            )}

            <form className="flex flex-wrap items-end gap-3 mb-6">
                <div className="flex-1 min-w-48">
                    <Label htmlFor="q" className="text-xs text-ink-500 mb-1.5">Search</Label>
                    <Input id="q" name="q" defaultValue={q} placeholder="Search by email or name…" />
                </div>
                <Button type="submit" variant="outline" className="rounded-md">
                    Filter
                </Button>
                {q && (
                    <Link href="/admin/users" className="text-sm text-ink-500 hover:text-ink-700 mb-2">
                        Clear
                    </Link>
                )}
            </form>

            {users.length === 0 ? (
                <p className="text-ink-500 text-center py-20">No users found.</p>
            ) : (
                <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-ink-50 text-ink-500 uppercase text-xs tracking-wide">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="px-6 py-4">Email</TableHead>
                                <TableHead className="px-6 py-4">Name</TableHead>
                                <TableHead className="px-6 py-4">Created</TableHead>
                                <TableHead className="px-6 py-4 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-ink-100">
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="px-6 py-4 whitespace-normal">
                                        <div className="font-medium text-ink-900">{user.email}</div>
                                        {user.email === session?.email && (
                                            <span className="text-xs text-brand">You</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-ink-600">{user.name || '—'}</TableCell>
                                    <TableCell className="px-6 py-4 text-ink-500">
                                        {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(user.createdAt)}
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/users/${user.id}/edit`}>
                                                <Button size="sm" variant="outline" className="rounded-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <DeleteButton
                                                action={deleteUserAction}
                                                id={user.id}
                                                title="Delete this user?"
                                                description={`"${user.email}" will permanently lose access to the admin panel.`}
                                                disabled={user.email === session?.email}
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
                basePath="/admin/users"
                currentPage={currentPage}
                totalPages={totalPages}
                searchParams={{ q }}
            />
        </div>
    );
}
