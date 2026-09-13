'use client';

import * as React from 'react';
import { AtSign, CalendarClock, MessageSquareText, Tag } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface TicketRow {
    id: string;
    subject: string;
    customerName: string;
    customerEmail: string;
    status: string;
    statusLabel: string;
    statusVariant: BadgeVariant;
    updated: string;
}

export function TicketsList({ rows }: { rows: TicketRow[] }) {
    const statuses = React.useMemo(() => {
        const seen = new Map<string, string>();
        for (const row of rows) seen.set(row.status, row.statusLabel);
        return [...seen.entries()];
    }, [rows]);

    const [status, setStatus] = useUrlParam('status', 'all');
    const visible = React.useMemo(
        () => (status === 'all' ? rows : rows.filter((row) => row.status === status)),
        [rows, status],
    );

    const columns: ListViewColumn<TicketRow>[] = [
        renderedColumn<TicketRow, StackedValue>({
            headerName: 'Subject',
            icon: <Tag />,
            flex: 2,
            minWidth: 240,
            cellRenderer: StackedCell,
            text: (row) => row.subject,
            get: (row) => ({ primary: row.subject, href: `/admin/tickets/${row.id}` }),
        }),
        renderedColumn<TicketRow, StackedValue>({
            headerName: 'Customer',
            icon: <AtSign />,
            flex: 1.4,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => `${row.customerName} ${row.customerEmail}`,
            get: (row) => ({ primary: row.customerName, secondary: row.customerEmail }),
        }),
        renderedColumn<TicketRow, BadgeValue>({
            headerName: 'Status',
            icon: <MessageSquareText />,
            width: 160,
            cellRenderer: BadgeCell,
            text: (row) => row.statusLabel,
            get: (row) => ({ label: row.statusLabel, variant: row.statusVariant }),
        }),
        {
            headerName: 'Updated',
            icon: <CalendarClock />,
            width: 170,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.updated,
        },
        renderedColumn<TicketRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 130,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({ actions: [{ label: 'View', href: `/admin/tickets/${row.id}` }] }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by subject or customer…"
            toolbar={
                statuses.length > 1 ? (
                    <FilterPills
                        label="Filter by status"
                        value={status}
                        onChange={setStatus}
                        options={[
                            { value: 'all', label: 'All', count: rows.length },
                            ...statuses.map(([value, label]) => ({
                                value,
                                label,
                                count: rows.filter((r) => r.status === value).length,
                            })),
                        ]}
                    />
                ) : null
            }
            emptyIcon={<MessageSquareText className="h-10 w-10 text-ink-300" />}
            emptyTitle="No support tickets"
            emptyMessage="Tickets raised by customers from their portal appear here."
        />
    );
}
