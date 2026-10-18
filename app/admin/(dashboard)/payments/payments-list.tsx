'use client';

import * as React from 'react';
import { AtSign, CalendarClock, CircleDollarSign, CreditCard, Hash } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface PaymentRow {
    id: string;
    reference: string;
    description: string;
    customerName: string;
    customerEmail: string;
    plan: string | null;
    amount: number;
    amountLabel: string;
    refundedLabel: string | null;
    state: string;
    stateLabel: string;
    stateVariant: BadgeVariant;
    method: string;
    date: string;
}

export function PaymentsList({ rows }: { rows: PaymentRow[] }) {
    const states = React.useMemo(() => {
        const seen = new Map<string, string>();
        for (const row of rows) seen.set(row.state, row.stateLabel);
        return [...seen.entries()];
    }, [rows]);

    const [state, setState] = useUrlParam('status', 'all');
    const visible = React.useMemo(() => (state === 'all' ? rows : rows.filter((row) => row.state === state)), [rows, state]);

    const columns: ListViewColumn<PaymentRow>[] = [
        renderedColumn<PaymentRow, StackedValue>({
            headerName: 'Payment',
            icon: <Hash />,
            flex: 1.6,
            minWidth: 240,
            cellRenderer: StackedCell,
            text: (row) => `${row.reference} ${row.description}`,
            get: (row) => ({ primary: row.description, secondary: row.reference, href: `/admin/payments/${row.id}` }),
        }),
        renderedColumn<PaymentRow, StackedValue>({
            headerName: 'Customer',
            icon: <AtSign />,
            flex: 1.3,
            minWidth: 210,
            cellRenderer: StackedCell,
            text: (row) => `${row.customerName} ${row.customerEmail}`,
            get: (row) => ({ primary: row.customerName, secondary: row.customerEmail }),
        }),
        renderedColumn<PaymentRow, StackedValue>({
            headerName: 'Amount',
            icon: <CircleDollarSign />,
            width: 160,
            cellRenderer: StackedCell,
            text: (row) => row.amount,
            get: (row) => ({ primary: row.amountLabel, secondary: row.refundedLabel ? `${row.refundedLabel} refunded` : undefined }),
        }),
        renderedColumn<PaymentRow, BadgeValue>({
            headerName: 'Status',
            icon: <CreditCard />,
            width: 180,
            cellRenderer: BadgeCell,
            text: (row) => row.stateLabel,
            get: (row) => ({ label: row.stateLabel, variant: row.stateVariant }),
        }),
        {
            headerName: 'Method',
            width: 120,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.method,
        },
        {
            headerName: 'Date',
            icon: <CalendarClock />,
            width: 190,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.date,
        },
        renderedColumn<PaymentRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 130,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({ actions: [{ label: 'View', href: `/admin/payments/${row.id}` }] }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search by payment id, customer or description…"
            toolbar={
                states.length > 1 ? (
                    <FilterPills
                        label="Filter by status"
                        value={state}
                        onChange={setState}
                        options={[
                            { value: 'all', label: 'All', count: rows.length },
                            ...states.map(([value, label]) => ({ value, label, count: rows.filter((row) => row.state === value).length })),
                        ]}
                    />
                ) : null
            }
            emptyIcon={<CreditCard className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No payments yet"
            emptyMessage="Payments from customers appear here as Paddle reports them: paid, failed and refunded."
        />
    );
}
