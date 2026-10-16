'use client';

import * as React from 'react';
import { AtSign, CalendarDays, ShieldCheck, UserRound } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlEnum } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, AvatarCell, BadgeCell, MutedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'CUSTOMER';
    created: string;
    /** True for the signed-in admin; their own row cannot be deleted. */
    isSelf: boolean;
}

export function UsersList({
    rows,
    deleteAction,
}: {
    rows: UserRow[];
    deleteAction: (formData: FormData) => Promise<void>;
}) {
    const [role, setRole] = useUrlEnum('role', ['all', 'ADMIN', 'CUSTOMER'] as const, 'all');
    const visible = React.useMemo(
        () => (role === 'all' ? rows : rows.filter((row) => row.role === role)),
        [rows, role],
    );

    const columns: ListViewColumn<UserRow>[] = [
        renderedColumn<UserRow, StackedValue>({
            headerName: 'Name',
            icon: <UserRound />,
            flex: 1.6,
            minWidth: 220,
            cellRenderer: AvatarCell,
            text: (row) => row.name,
            get: (row) => ({
                primary: row.name,
                secondary: row.isSelf ? 'You' : undefined,
                href: `/admin/users/${row.id}`,
            }),
        }),
        {
            headerName: 'Email',
            icon: <AtSign />,
            flex: 1.6,
            minWidth: 220,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.email,
        },
        renderedColumn<UserRow, BadgeValue>({
            headerName: 'Role',
            icon: <ShieldCheck />,
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => row.role,
            get: (row) => ({
                label: row.role === 'ADMIN' ? 'Admin' : 'Customer',
                variant: row.role === 'ADMIN' ? 'neutral' : 'info',
            }),
        }),
        {
            headerName: 'Created',
            icon: <CalendarDays />,
            width: 160,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.created,
        },
        renderedColumn<UserRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 220,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/users/${row.id}/edit` }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: 'Delete this user?',
                    description: `"${row.email}" (${row.role === 'ADMIN' ? 'admin' : 'customer'}) will be permanently deleted. This action cannot be undone.`,
                    // Deleting your own account would end the session mid-request.
                    disabled: row.isSelf,
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by name or email…"
            toolbar={
                <FilterPills
                    label="Filter by role"
                    value={role}
                    onChange={setRole}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        { value: 'ADMIN', label: 'Admins', count: rows.filter((r) => r.role === 'ADMIN').length },
                        { value: 'CUSTOMER', label: 'Customers', count: rows.filter((r) => r.role === 'CUSTOMER').length },
                    ]}
                />
            }
            emptyIcon={<UserRound className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No users found"
            emptyMessage="Admins are created here; customers arrive by registering on the site."
        />
    );
}
