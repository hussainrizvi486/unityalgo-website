'use client';

import { Coins, Hash, Percent } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface CurrencyRow {
    id: string;
    code: string;
    name: string;
    symbol: string;
    numberFormat: string;
    /** The format applied to a sample amount, so the pattern is legible. */
    sample: string;
    isActive: boolean;
    planCount: number;
}

export function CurrenciesList({
    rows,
    deleteAction,
}: {
    rows: CurrencyRow[];
    deleteAction: (formData: FormData) => Promise<void>;
}) {
    const columns: ListViewColumn<CurrencyRow>[] = [
        renderedColumn<CurrencyRow, StackedValue>({
            headerName: 'Currency',
            icon: <Coins />,
            flex: 1.4,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => `${row.code} ${row.name}`,
            get: (row) => ({
                primary: `${row.code} · ${row.symbol}`,
                secondary: row.name,
                href: `/admin/currencies/${row.id}/edit`,
            }),
        }),
        renderedColumn<CurrencyRow, StackedValue>({
            headerName: 'Number format',
            icon: <Hash />,
            flex: 1.4,
            minWidth: 210,
            cellClass: 'font-mono text-xs',
            cellRenderer: StackedCell,
            text: (row) => row.numberFormat,
            get: (row) => ({ primary: row.numberFormat, secondary: row.sample }),
        }),
        {
            headerName: 'Used by',
            icon: <Percent />,
            width: 130,
            cellRenderer: MutedCell,
            valueGetter: (p) =>
                p.data?.planCount === 0 ? 'No plans' : `${p.data?.planCount} plan${p.data?.planCount === 1 ? '' : 's'}`,
        },
        renderedColumn<CurrencyRow, BadgeValue>({
            headerName: 'Status',
            width: 130,
            cellRenderer: BadgeCell,
            text: (row) => (row.isActive ? 'Enabled' : 'Disabled'),
            get: (row) => ({
                label: row.isActive ? 'Enabled' : 'Disabled',
                variant: row.isActive ? 'success' : 'neutral',
                dot: true,
            }),
        }),
        renderedColumn<CurrencyRow, ActionsValue>({
            headerName: '',
            width: 140,
            sortable: false,
            filter: false,
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/currencies/${row.id}/edit` }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: `Delete ${row.code}?`,
                    description: row.planCount > 0
                        ? `${row.planCount} plan${row.planCount === 1 ? '' : 's'} priced in ${row.code} will keep their price and fall back to the default display currency.`
                        : 'Nothing is priced in this currency.',
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search currencies…"
            emptyTitle="No currencies"
            emptyMessage="Add a currency before pricing a plan in it."
            emptyIcon={<Coins className="h-10 w-10" />}
            emptyAction={{ label: 'Add currency', href: '/admin/currencies/new' }}
        />
    );
}
