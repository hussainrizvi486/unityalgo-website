'use client';

import * as React from 'react';
import { DollarSign, Layers, Tag, Users } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, MutedCell, StackedCell,
    type ActionsValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface PlanRow {
    id: string;
    name: string;
    tagline: string | null;
    product: string;
    productLabel: string;
    price: string;
    /** Null when the plan is not yet in Paddle. */
    paddlePriceId: string | null;
    /** False for custom-quote plans, which have no amount to push. */
    canSync: boolean;
    seats: string;
    isActive: boolean;
}

export function PlansList({
    rows,
    toggleAction,
    deleteAction,
    syncAction,
}: {
    rows: PlanRow[];
    toggleAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
    syncAction: (formData: FormData) => Promise<void>;
}) {
    const products = React.useMemo(() => {
        const seen = new Map<string, string>();
        for (const row of rows) seen.set(row.product, row.productLabel);
        return [...seen.entries()];
    }, [rows]);

    const [product, setProduct] = useUrlParam('product', 'all');
    const visible = React.useMemo(
        () => (product === 'all' ? rows : rows.filter((row) => row.product === product)),
        [rows, product],
    );

    const columns: ListViewColumn<PlanRow>[] = [
        renderedColumn<PlanRow, StackedValue>({
            headerName: 'Plan',
            icon: <Tag />,
            flex: 2,
            minWidth: 220,
            cellRenderer: StackedCell,
            text: (row) => `${row.name} ${row.tagline ?? ''}`,
            get: (row) => ({
                primary: row.name,
                secondary: row.tagline,
                href: `/admin/plans/${row.id}/edit`,
            }),
        }),
        {
            headerName: 'Product',
            icon: <Layers />,
            width: 170,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.productLabel,
        },
        {
            headerName: 'Price',
            icon: <DollarSign />,
            width: 160,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.price,
        },
        {
            headerName: 'Seats',
            icon: <Users />,
            width: 140,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.seats,
        },
        renderedColumn<PlanRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 330,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                badge: {
                    label: row.isActive ? 'Active' : 'Disabled',
                    variant: row.isActive ? 'success' : 'neutral',
                },
                submits: [
                    {
                        label: row.isActive ? 'Disable' : 'Enable',
                        action: toggleAction,
                        id: row.id,
                    },
                    ...(row.canSync
                        ? [{ label: row.paddlePriceId ? 'Sync' : 'Add to Paddle', action: syncAction, id: row.id }]
                        : []),
                ],
                actions: [{ label: 'Edit', href: `/admin/plans/${row.id}/edit` }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: 'Delete this plan?',
                    description: `"${row.name}" will be permanently deleted. This action cannot be undone. Plans with active subscriptions can't be deleted — disable them instead.`,
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search plans…"
            toolbar={
                products.length > 1 ? (
                    <FilterPills
                        label="Filter by product"
                        value={product}
                        onChange={setProduct}
                        options={[
                            { value: 'all', label: 'All', count: rows.length },
                            ...products.map(([value, label]) => ({
                                value,
                                label,
                                count: rows.filter((r) => r.product === value).length,
                            })),
                        ]}
                    />
                ) : null
            }
            emptyIcon={<Layers className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No plans yet"
            emptyMessage="Plans are what customers subscribe to. Create one to start selling."
            emptyAction={{ label: 'New plan', href: '/admin/plans/new' }}
        />
    );
}
