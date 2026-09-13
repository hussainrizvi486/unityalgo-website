'use client';

import * as React from 'react';
import { AtSign, CalendarClock, Inbox, Phone, Tag, UserRound } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, BadgeCell, ClampedCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface LeadRow {
    id: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    status: string;
    statusLabel: string;
    statusVariant: BadgeVariant;
    sourceLabel: string;
    /** Set when this email already has an account. */
    userId: string | null;
    created: string;
}

export function LeadsList({ rows }: { rows: LeadRow[] }) {
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

    const columns: ListViewColumn<LeadRow>[] = [
        renderedColumn<LeadRow, StackedValue>({
            headerName: 'Name',
            icon: <UserRound />,
            flex: 1.4,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => `${row.name} ${row.email}`,
            get: (row) => ({
                primary: row.name,
                secondary: row.email,
                href: `/admin/leads/${row.id}`,
            }),
        }),
        renderedColumn<LeadRow, string>({
            headerName: 'Phone',
            icon: <Phone />,
            flex: 1,
            minWidth: 150,
            cellRenderer: MutedCell,
            text: (row) => row.phone,
            get: (row) => row.phone,
        }),
        renderedColumn<LeadRow, string>({
            headerName: 'Message',
            icon: <Inbox />,
            flex: 2,
            minWidth: 260,
            cellRenderer: ClampedCell,
            text: (row) => row.message,
            get: (row) => row.message,
        }),
        renderedColumn<LeadRow, BadgeValue>({
            headerName: 'Status',
            icon: <Tag />,
            flex: 0.9,
            minWidth: 130,
            cellRenderer: BadgeCell,
            text: (row) => row.statusLabel,
            get: (row) => ({ label: row.statusLabel, variant: row.statusVariant }),
        }),
        renderedColumn<LeadRow, string>({
            headerName: 'Source',
            icon: <AtSign />,
            flex: 0.9,
            minWidth: 130,
            cellRenderer: MutedCell,
            text: (row) => row.sourceLabel,
            get: (row) => row.sourceLabel,
        }),
        renderedColumn<LeadRow, string>({
            headerName: 'Received',
            icon: <CalendarClock />,
            flex: 0.9,
            minWidth: 140,
            cellRenderer: MutedCell,
            text: (row) => row.created,
            get: (row) => row.created,
        }),
        renderedColumn<LeadRow, ActionsValue>({
            headerName: '',
            headerAlign: 'right',
            flex: 0.8,
            minWidth: 120,
            sortable: false,
            cellRenderer: ActionsCell,
            get: (row) => ({ actions: [{ label: 'Open', href: `/admin/leads/${row.id}` }] }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search leads by name, email, phone or message…"
            toolbar={
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
            }
            emptyIcon={<Inbox className="h-10 w-10 text-ink-300" />}
            emptyTitle="No leads yet"
            emptyMessage="Enquiries from the website contact form arrive here."
        />
    );
}
