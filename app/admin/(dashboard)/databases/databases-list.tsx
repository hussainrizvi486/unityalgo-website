'use client';

import { Database, Network, ShieldCheck } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface DatabaseRow {
    id: string;
    name: string;
    engine: 'postgres' | 'mariadb';
    kind: string;
    isDefault: boolean;
    address: string;
    username: string;
    sslmode: string;
    lastTestStatus: string | null;
}

export function DatabasesList({
    rows,
    testAction,
}: {
    rows: DatabaseRow[];
    testAction: (formData: FormData) => Promise<void>;
}) {
    const columns: ListViewColumn<DatabaseRow>[] = [
        renderedColumn<DatabaseRow, StackedValue>({
            headerName: 'Name',
            icon: <Database />,
            flex: 1.5,
            minWidth: 210,
            cellRenderer: StackedCell,
            text: (row) => row.name,
            get: (row) => ({
                primary: row.name,
                secondary: row.kind,
                href: `/admin/databases/${row.id}`,
            }),
        }),
        renderedColumn<DatabaseRow, StackedValue>({
            headerName: 'Address',
            icon: <Network />,
            flex: 1.5,
            minWidth: 220,
            cellClass: 'font-mono portal-text-caption',
            cellRenderer: StackedCell,
            text: (row) => `${row.address} ${row.username}`,
            get: (row) => ({ primary: row.address, secondary: row.username }),
        }),
        {
            headerName: 'SSL',
            icon: <ShieldCheck />,
            width: 120,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.sslmode,
        },
        renderedColumn<DatabaseRow, BadgeValue | null>({
            headerName: 'Last test',
            width: 140,
            cellRenderer: BadgeCell,
            text: (row) => row.lastTestStatus ?? 'never',
            get: (row) =>
                row.lastTestStatus
                    ? {
                          label: row.lastTestStatus,
                          variant: row.lastTestStatus === 'success' ? 'success' : 'error',
                      }
                    : { label: 'never', variant: 'neutral', dot: false },
        }),
        renderedColumn<DatabaseRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 220,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                submits: [{ label: 'Test', action: testAction, id: row.id }],
                // The schema browser and query console work on both engines.
                actions: [
                    { label: 'Browse', href: `/admin/databases/${row.id}/browse`, tone: 'solid' as const },
                    { label: 'Manage', href: `/admin/databases/${row.id}` },
                ],
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by name or host…"
            emptyIcon={<Database className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No databases registered"
            emptyMessage="Register a PostgreSQL instance for tenant databases, or a MariaDB server for Frappe sites."
            emptyAction={{ label: 'Register a database', href: '/admin/databases/new' }}
        />
    );
}
