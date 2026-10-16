'use client';

import * as React from 'react';
import { DollarSign, Layers, PackagePlus, Tag } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, MutedCell, StackedCell,
    type ActionsValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface AddOnRow {
    id: string;
    name: string;
    description: string | null;
    product: string;
    productLabel: string;
    price: string;
    isActive: boolean;
}

export function AddOnsList({
    rows,
    toggleAction,
    deleteAction,
}: {
    rows: AddOnRow[];
    toggleAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
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

    const columns: ListViewColumn<AddOnRow>[] = [
        renderedColumn<AddOnRow, StackedValue>({
            headerName: 'Add-on',
            icon: <Tag />,
            flex: 2,
            minWidth: 240,
            cellRenderer: StackedCell,
            text: (row) => `${row.name} ${row.description ?? ''}`,
            get: (row) => ({
                primary: row.name,
                secondary: row.description,
                href: `/admin/addons/${row.id}/edit`,
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
            width: 170,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.price,
        },
        renderedColumn<AddOnRow, ActionsValue>({
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
                submits: [{
                    label: row.isActive ? 'Disable' : 'Enable',
                    action: toggleAction,
                    id: row.id,
                }],
                actions: [{ label: 'Edit', href: `/admin/addons/${row.id}/edit` }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: 'Delete this add-on?',
                    description: `"${row.name}" will be permanently deleted. This action cannot be undone. Add-ons attached to active subscriptions can't be deleted — disable them instead.`,
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search add-ons…"
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
            emptyIcon={<PackagePlus className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No add-ons yet"
            emptyMessage="Add-ons are optional extras customers attach to a subscription."
            emptyAction={{ label: 'New add-on', href: '/admin/addons/new' }}
        />
    );
}
