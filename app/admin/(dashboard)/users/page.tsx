import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDate } from '@/lib/admin-format';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { deleteUserAction } from '@/app/admin/actions';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { UsersList, type UserRow } from './users-list';

interface UsersPageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
    const params = await searchParams;

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

    const [users, totalCount] = await Promise.all([
        prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: ADMIN_LIST_LIMIT }),
        prisma.user.count(),
    ]);

    const rows: UserRow[] = users.map((user) => ({
        id: user.id,
        name:
            user.name
            || [user.firstName, user.lastName].filter(Boolean).join(' ')
            || user.email,
        email: user.email,
        role: user.role,
        created: formatDate(user.createdAt),
        isSelf: user.email === session?.email,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Users"
                subtitle={
                    rows.length < totalCount
                        ? `Showing ${rows.length} of ${totalCount}`
                        : `${totalCount} total`
                }
                action={{ label: 'New Admin', href: '/admin/users/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            <UsersList rows={rows} deleteAction={deleteUserAction} />
        </div>
    );
}
