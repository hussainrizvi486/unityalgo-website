import type * as React from 'react';
import type { ColDef } from 'ag-grid-community';

export interface ListViewColumn<Row> extends ColDef<Row> {
    /** Column header text. */
    headerName: string;
    /** Icon shown before the header text, as on the panel's other tables. */
    icon?: React.ReactNode;
    /** Right-align the header; use on the trailing actions column. */
    headerAlign?: 'left' | 'right';
}

export function renderedColumn<Row, Value>(
    column: ListViewColumn<Row> & {
        cellRenderer: unknown;
        text?: (row: Row) => string | number | null | undefined;
        get: (row: Row) => Value;
    },
): ListViewColumn<Row> {
    const { text, get, ...rest } = column;
    return {
        ...rest,
        valueGetter: text ? (params) => (params.data ? text(params.data) : null) : undefined,
        cellRendererParams: { get, ...(rest.cellRendererParams ?? {}) },
    };
}

export interface ListViewProps<Row> {
    rows: Row[];
    columns: ListViewColumn<Row>[];
    /** Stable row identity; prevents re-render churn when data updates. */
    getRowId: (row: Row) => string;

    /** Placeholder for the built-in quick filter. Omit to hide the search box. */
    searchPlaceholder?: string;
    /** Rendered to the right of the search box — selects, status pills, etc. */
    toolbar?: React.ReactNode;

    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    /** Call-to-action shown in the empty state. */
    emptyAction?: { label: string; href: string };

    /** Rows per page. Matches ADMIN_PAGE_SIZE by default. */
    pageSize?: number;
    /** Height of the grid viewport. */
    height?: number;
    className?: string;
}
