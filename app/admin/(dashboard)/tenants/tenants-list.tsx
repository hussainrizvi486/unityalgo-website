'use client';

import * as React from 'react';
import { Boxes, Globe, Layers, Mail, Server } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlEnum } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, MutedCell, StackedCell,
    type ActionsValue, type StackedValue,
} from '@/components/admin/grid-cells';
import type { TenantStatus } from '@/lib/controller-client';
import { TENANT_STATUS_BADGE, TENANT_STATUS_LABEL } from '@/lib/controller-status';

export interface TenantRow {
    id: string;
    slug: string;
    created: string;
    domain: string;
    /** Null when the tenant has no linked account — only an email on record. */
    customerId: string | null;
    customerName: string;
    customerEmail: string;
    planName: string;
    planDetail: string | null;
    resources: string;
    status: TenantStatus;
}

export function TenantsList({ rows }: { rows: TenantRow[] }) {
    const [status, setStatus] = useUrlEnum('status', ['all', 'pending', 'active', 'paused', 'terminated'] as const, 'all');
    const visible = React.useMemo(
        () => (status === 'all' ? rows : rows.filter((row) => row.status === status)),
        [rows, status],
    );

    const columns: ListViewColumn<TenantRow>[] = [
        renderedColumn<TenantRow, StackedValue>({
            headerName: 'Tenant',
            icon: <Boxes />,
            flex: 1.5,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => row.slug,
            get: (row) => ({
                primary: row.slug,
                secondary: row.created,
                href: `/admin/tenants/${row.id}`,
            }),
        }),
        {
            headerName: 'Domain',
            icon: <Globe />,
            flex: 1.4,
            minWidth: 190,
            cellClass: 'font-mono portal-text-caption',
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.domain,
        },
        renderedColumn<TenantRow, StackedValue>({
            headerName: 'Customer',
            icon: <Mail />,
            flex: 1.3,
            minWidth: 190,
            cellRenderer: StackedCell,
            text: (row) => `${row.customerName} ${row.customerEmail}`,
            get: (row) => ({
                primary: row.customerName,
                secondary: row.customerEmail,
                // Only linked accounts have a page to open.
                href: row.customerId ? `/admin/users/${row.customerId}` : undefined,
            }),
        }),
        renderedColumn<TenantRow, StackedValue>({
            headerName: 'Plan',
            icon: <Layers />,
            width: 160,
            cellRenderer: StackedCell,
            text: (row) => row.planName,
            get: (row) => ({ primary: row.planName, secondary: row.planDetail }),
        }),
        {
            headerName: 'Resources',
            icon: <Server />,
            width: 160,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.resources,
        },
        renderedColumn<TenantRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 220,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                badge: {
                    label: TENANT_STATUS_LABEL[row.status],
                    variant: TENANT_STATUS_BADGE[row.status],
                },
                actions: [{ label: 'Manage', href: `/admin/tenants/${row.id}` }],
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by slug, domain, customer or plan…"
            toolbar={
                <FilterPills
                    label="Filter by status"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        ...(['active', 'pending', 'paused', 'terminated'] as const).map((value) => ({
                            value,
                            label: TENANT_STATUS_LABEL[value],
                            count: rows.filter((r) => r.status === value).length,
                        })),
                    ]}
                />
            }
            emptyIcon={<Boxes className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No tenants yet"
            emptyMessage="Creating a tenant reserves its slug and database. Provisioning it deploys the container."
            emptyAction={{ label: 'New tenant', href: '/admin/tenants/new' }}
        />
    );
}
