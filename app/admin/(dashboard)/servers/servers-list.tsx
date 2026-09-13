'use client';

import { Boxes, Cpu, MemoryStick, Network, Server } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface ServerRow {
    id: string;
    name: string;
    specs: string;
    ipAddress: string;
    privateIp: string | null;
    role: string;
    memory: string;
    containers: string;
    isActive: boolean;
}

export function ServersList({ rows }: { rows: ServerRow[] }) {
    const columns: ListViewColumn<ServerRow>[] = [
        renderedColumn<ServerRow, StackedValue>({
            headerName: 'Node',
            icon: <Server />,
            flex: 1.6,
            minWidth: 220,
            cellRenderer: StackedCell,
            text: (row) => row.name,
            get: (row) => ({
                primary: row.name,
                secondary: row.specs,
                href: `/admin/servers/${row.id}`,
            }),
        }),
        renderedColumn<ServerRow, StackedValue>({
            headerName: 'Address',
            icon: <Network />,
            flex: 1.2,
            minWidth: 170,
            cellClass: 'font-mono text-xs',
            cellRenderer: StackedCell,
            text: (row) => `${row.ipAddress} ${row.privateIp ?? ''}`,
            get: (row) => ({ primary: row.ipAddress, secondary: row.privateIp }),
        }),
        renderedColumn<ServerRow, BadgeValue>({
            headerName: 'Role',
            icon: <Cpu />,
            width: 130,
            cellRenderer: BadgeCell,
            text: (row) => row.role,
            get: (row) => ({
                label: row.role,
                variant: row.role === 'proxy' ? 'info' : 'neutral',
            }),
        }),
        {
            headerName: 'Memory',
            icon: <MemoryStick />,
            width: 170,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.memory,
        },
        {
            headerName: 'Containers',
            icon: <Boxes />,
            width: 140,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.containers,
        },
        renderedColumn<ServerRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 220,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                badge: {
                    label: row.isActive ? 'Active' : 'Disabled',
                    variant: row.isActive ? 'success' : 'neutral',
                },
                actions: [{ label: 'Manage', href: `/admin/servers/${row.id}` }],
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search nodes by name or address…"
            emptyIcon={<Server className="h-10 w-10 text-ink-300" />}
            emptyTitle="No nodes registered"
            emptyMessage="Register a worker or proxy VPS to start provisioning tenants onto it."
            emptyAction={{ label: 'Register a node', href: '/admin/servers/new' }}
        />
    );
}
