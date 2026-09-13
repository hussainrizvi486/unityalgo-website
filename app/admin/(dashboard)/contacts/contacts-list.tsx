'use client';

import { AtSign, CalendarDays, MessageSquareText, UserRound } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { ActionsCell, AvatarCell, ClampedCell, MutedCell } from '@/components/admin/grid-cells';

export interface ContactRow {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    message: string;
    received: string;
}

export function ContactsList({
    rows,
    deleteAction,
}: {
    rows: ContactRow[];
    deleteAction: (formData: FormData) => Promise<void>;
}) {
    const columns: ListViewColumn<ContactRow>[] = [
        renderedColumn<ContactRow, { primary: string }>({
            headerName: 'Name',
            icon: <UserRound />,
            flex: 1.3,
            minWidth: 200,
            cellRenderer: AvatarCell,
            text: (row) => row.name,
            get: (row) => ({ primary: row.name }),
        }),
        {
            headerName: 'Contact',
            icon: <AtSign />,
            flex: 1.2,
            minWidth: 190,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.email,
        },
        {
            headerName: 'Message',
            icon: <MessageSquareText />,
            flex: 2,
            minWidth: 220,
            cellRenderer: ClampedCell,
            valueGetter: (p) => p.data?.message,
        },
        {
            headerName: 'Received',
            icon: <CalendarDays />,
            width: 190,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.received,
        },
        renderedColumn<ContactRow, { actions: { label: string; href: string }[] }>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 150,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/contacts/${row.id}/edit` }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: 'Delete this submission?',
                    description: `The message from "${row.name}" will be permanently deleted.`,
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by name, email or message…"
            emptyIcon={<MessageSquareText className="h-10 w-10 text-ink-300" />}
            emptyTitle="No contact submissions"
            emptyMessage="Messages sent through the website's contact form land here."
        />
    );
}
