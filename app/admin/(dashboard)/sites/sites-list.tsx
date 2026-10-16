'use client';

import * as React from 'react';
import { Database, Globe, Mail, Server } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface SiteRow {
    id: string;
    name: string;
    domain: string;
    owner: string;
    plan: string;
    server: string;
    database: string;
    created: string;
    status: string;
    message: string;
    logHref: string;
}

const statusBadge = (status: string): { label: string; variant: BadgeVariant } => {
    if (status === 'ready') return { label: 'Active', variant: 'success' };
    if (status === 'stopped') return { label: 'Stopped', variant: 'neutral' };
    if (['failed', 'cleanup_required'].includes(status))
        return { label: status === 'failed' ? 'Failed' : 'Needs cleanup', variant: 'error' };
    if (status === 'deleting') return { label: 'Deleting', variant: 'warning' };
    return { label: status.replaceAll('_', ' '), variant: 'info' };
};

/** Every customer's site, with the controls an operator needs when one is stuck. */
export function SitesList({
    rows,
    removeAction,
}: {
    rows: SiteRow[];
    removeAction: (formData: FormData) => Promise<void>;
}) {
    const [filter, setFilter] = useUrlParam('status', 'all');
    const visible = React.useMemo(
        () =>
            filter === 'all' ? rows
            : filter === 'attention' ? rows.filter((row) => ['failed', 'cleanup_required'].includes(row.status))
            : rows.filter((row) => row.status === filter),
        [rows, filter],
    );

    const columns: ListViewColumn<SiteRow>[] = [
        renderedColumn<SiteRow, StackedValue>({
            headerName: 'Site',
            icon: <Globe />,
            flex: 1.6,
            minWidth: 230,
            cellRenderer: StackedCell,
            text: (row) => `${row.name} ${row.domain}`,
            get: (row) => ({ primary: row.name, secondary: row.domain, href: `/admin/sites/${row.id}` }),
        }),
        renderedColumn<SiteRow, StackedValue>({
            headerName: 'Owner',
            icon: <Mail />,
            flex: 1.2,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => `${row.owner} ${row.plan}`,
            get: (row) => ({ primary: row.owner, secondary: row.plan }),
        }),
        renderedColumn<SiteRow, StackedValue>({
            headerName: 'Hosting',
            icon: <Server />,
            flex: 1,
            minWidth: 170,
            cellRenderer: StackedCell,
            text: (row) => `${row.server} ${row.database}`,
            get: (row) => ({ primary: row.server, secondary: row.database }),
        }),
        { headerName: 'Created', icon: <Database />, width: 190, cellRenderer: MutedCell, valueGetter: (p) => p.data?.created },
        renderedColumn<SiteRow, BadgeValue>({
            headerName: 'Status',
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => statusBadge(row.status).label,
            get: (row) => statusBadge(row.status),
        }),
        renderedColumn<SiteRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 220,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Manage', href: `/admin/sites/${row.id}` }, { label: 'Logs', href: row.logHref }],
                remove: {
                    action: removeAction,
                    id: row.id,
                    title: `Delete ${row.name}?`,
                    description:
                        'Permanently removes the site, its containers, volumes and database from the server. '
                        + 'It works even on a site stuck half-created. This cannot be undone.',
                    disabled: row.status === 'deleting',
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by site, domain or owner…"
            toolbar={
                <FilterPills
                    label="Filter by status"
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        { value: 'ready', label: 'Active', count: rows.filter((r) => r.status === 'ready').length },
                        { value: 'stopped', label: 'Stopped', count: rows.filter((r) => r.status === 'stopped').length },
                        { value: 'attention', label: 'Needs attention', count: rows.filter((r) => ['failed', 'cleanup_required'].includes(r.status)).length },
                    ]}
                />
            }
            emptyIcon={<Globe className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No customer sites yet"
            emptyMessage="Sites customers create from their dashboard appear here."
        />
    );
}
