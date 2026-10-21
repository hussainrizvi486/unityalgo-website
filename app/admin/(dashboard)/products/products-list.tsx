'use client';

import { Eye, Layers, Package } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface ProductRow {
    id: string;
    label: string;
    slug: string;
    tagline: string | null;
    planCount: number;
    isActive: boolean;
    showOnLanding: boolean;
}

export function ProductsList({
    rows,
    deleteAction,
    toggleAction,
}: {
    rows: ProductRow[];
    deleteAction: (formData: FormData) => Promise<void>;
    toggleAction: (formData: FormData) => Promise<void>;
}) {
    const columns: ListViewColumn<ProductRow>[] = [
        renderedColumn<ProductRow, StackedValue>({
            headerName: 'Product',
            icon: <Package />,
            flex: 1.6,
            minWidth: 220,
            cellRenderer: StackedCell,
            text: (row) => `${row.label} ${row.slug} ${row.tagline ?? ''}`,
            get: (row) => ({ primary: row.label, secondary: row.tagline || row.slug, href: `/admin/products/${row.id}/edit` }),
        }),
        renderedColumn<ProductRow, string>({
            headerName: 'Slug',
            flex: 1,
            minWidth: 140,
            cellClass: 'font-mono portal-text-caption',
            cellRenderer: MutedCell,
            text: (row) => row.slug,
            get: (row) => row.slug,
        }),
        renderedColumn<ProductRow, string>({
            headerName: 'Plans',
            icon: <Layers />,
            width: 120,
            cellRenderer: MutedCell,
            text: (row) => String(row.planCount),
            get: (row) => (row.planCount === 0 ? 'No plans' : `${row.planCount} plan${row.planCount === 1 ? '' : 's'}`),
        }),
        renderedColumn<ProductRow, string>({
            headerName: 'On website',
            icon: <Eye />,
            width: 130,
            cellRenderer: MutedCell,
            text: (row) => (row.showOnLanding ? 'Shown' : 'Hidden'),
            get: (row) => (row.showOnLanding ? 'Shown' : 'Hidden'),
        }),
        renderedColumn<ProductRow, BadgeValue>({
            headerName: 'Status',
            width: 120,
            cellRenderer: BadgeCell,
            text: (row) => (row.isActive ? 'Active' : 'Disabled'),
            get: (row) => ({ label: row.isActive ? 'Active' : 'Disabled', variant: row.isActive ? 'success' : 'neutral', dot: true }),
        }),
        renderedColumn<ProductRow, ActionsValue>({
            headerName: '',
            width: 280,
            sortable: false,
            filter: false,
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/products/${row.id}/edit` }],
                submits: [{ label: row.isActive ? 'Disable' : 'Enable', action: toggleAction, id: row.id }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: `Delete ${row.label}?`,
                    description: row.planCount > 0
                        ? `${row.label} still has ${row.planCount} plan${row.planCount === 1 ? '' : 's'}, so it cannot be deleted. Disable it instead.`
                        : 'This permanently removes the product.',
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search products…"
            emptyTitle="No products"
            emptyMessage="Add a product before creating plans for it."
            emptyIcon={<Package className="h-10 w-10" />}
            emptyAction={{ label: 'Add product', href: '/admin/products/new' }}
        />
    );
}
