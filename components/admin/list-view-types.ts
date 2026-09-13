import type * as React from 'react';
import type { ColDef } from 'ag-grid-community';

/**
 * Column shapes for the admin list view.
 *
 * Separate from the component so a page can describe its columns without
 * pulling AG Grid into the bundle: the `ColDef` import here is type-only and
 * erased at build, while `list-view-grid.tsx` holds the runtime.
 */

export interface ListViewColumn<Row> extends ColDef<Row> {
    /** Column header text. */
    headerName: string;
    /** Icon shown before the header text, as on the panel's other tables. */
    icon?: React.ReactNode;
    /** Right-align the header; use on the trailing actions column. */
    headerAlign?: 'left' | 'right';
}

/**
 * Builds a column whose cell is drawn by one of the shared renderers.
 *
 * `text` is what the column sorts and searches by; `get` is the rich object the
 * renderer draws. Keeping them separate is what lets a "Name" column search on
 * the plain name while rendering an avatar, a link and a subtitle.
 */
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
