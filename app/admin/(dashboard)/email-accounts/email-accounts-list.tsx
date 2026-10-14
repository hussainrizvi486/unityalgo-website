'use client';

import { AtSign, Inbox, Send, ShieldCheck } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface EmailAccountRow {
    id: string;
    label: string;
    address: string;
    purpose: string;
    smtp: string;
    /** "IMAP host:port", or null when the account only sends. */
    imap: string | null;
    isDefault: boolean;
    isActive: boolean;
    /** Human summary of the last connection test. */
    testStatus: string;
    testOk: boolean | null;
}

export function EmailAccountsList({
    rows,
    testAction,
    deleteAction,
}: {
    rows: EmailAccountRow[];
    testAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
}) {
    const columns: ListViewColumn<EmailAccountRow>[] = [
        renderedColumn<EmailAccountRow, StackedValue>({
            headerName: 'Account',
            icon: <AtSign />,
            flex: 1.6,
            minWidth: 230,
            cellRenderer: StackedCell,
            text: (row) => `${row.label} ${row.address}`,
            get: (row) => ({
                primary: row.isDefault ? `${row.label} · default` : row.label,
                secondary: row.address,
                href: `/admin/email-accounts/${row.id}/edit`,
            }),
        }),
        renderedColumn<EmailAccountRow, BadgeValue>({
            headerName: 'Purpose',
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => row.purpose,
            get: (row) => ({ label: row.purpose, variant: 'info' }),
        }),
        renderedColumn<EmailAccountRow, StackedValue>({
            headerName: 'Outgoing',
            icon: <Send />,
            flex: 1.3,
            minWidth: 200,
            cellClass: 'font-mono portal-text-caption',
            cellRenderer: StackedCell,
            text: (row) => row.smtp,
            get: (row) => ({ primary: row.smtp, secondary: 'SMTP' }),
        }),
        renderedColumn<EmailAccountRow, StackedValue>({
            headerName: 'Incoming',
            icon: <Inbox />,
            flex: 1.3,
            minWidth: 200,
            cellClass: 'font-mono portal-text-caption',
            cellRenderer: StackedCell,
            text: (row) => row.imap ?? 'Send only',
            get: (row) => ({
                primary: row.imap ?? 'Send only',
                secondary: row.imap ? 'IMAP' : 'no mailbox configured',
            }),
        }),
        renderedColumn<EmailAccountRow, BadgeValue>({
            headerName: 'Connection',
            icon: <ShieldCheck />,
            width: 170,
            cellRenderer: BadgeCell,
            text: (row) => row.testStatus,
            get: (row) => ({
                label: row.testStatus,
                variant: row.testOk === null ? 'neutral' : row.testOk ? 'success' : 'error',
            }),
        }),
        {
            headerName: 'Status',
            width: 110,
            cellRenderer: MutedCell,
            valueGetter: (p) => (p.data?.isActive ? 'Active' : 'Disabled'),
        },
        renderedColumn<EmailAccountRow, ActionsValue>({
            headerName: '',
            width: 150,
            sortable: false,
            filter: false,
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/email-accounts/${row.id}/edit` }],
                submits: [{ label: 'Test', action: testAction, id: row.id }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: `Delete "${row.label}"?`,
                    description:
                        'Mail for this purpose will fall back to the default account, '
                        + 'or to the SMTP_* environment variables if there is no default.',
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search accounts…"
            emptyTitle="No email accounts"
            emptyMessage="Add a mailbox to send from. Until one exists, the platform falls back to the SMTP_* environment variables."
            emptyIcon={<AtSign className="h-10 w-10" />}
            emptyAction={{ label: 'Add account', href: '/admin/email-accounts/new' }}
        />
    );
}
