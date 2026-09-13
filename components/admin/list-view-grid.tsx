'use client';

import * as React from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
    AllCommunityModule,
    ModuleRegistry,
    type ColDef,
    type GridReadyEvent,
    type GridApi,
    type SortChangedEvent,
    type PaginationChangedEvent,
} from 'ag-grid-community';
import { adminGridTheme } from '@/components/admin/grid-theme';
import { AdminGridHeader } from '@/components/admin/grid-header';
import type { ListViewColumn } from '@/components/admin/list-view-types';

/**
 * The AG Grid half of the admin list view.
 *
 * Split out so it can be reached through `next/dynamic`. AG Grid is ~1.1MB, and
 * because most routes under /admin render a list, the bundler was hoisting it
 * into the layout's shared chunk — which meant every form page, including
 * "New user" and "New plan", downloaded a grid it never rendered.
 *
 * The toolbar, empty state and search live in the wrapper, so they still render
 * immediately while this loads.
 */
export function ListViewGrid<Row>({
    rows,
    columns,
    getRowId,
    query,
    pageSize,
    height,
    sort,
    onSortChange,
    page,
    onPageChange,
}: {
    rows: Row[];
    columns: ListViewColumn<Row>[];
    getRowId: (row: Row) => string;
    query: string;
    pageSize: number;
    height: number;
    /** "colId:asc" / "colId:desc", or '' for the grid's natural order. */
    sort: string;
    onSortChange: (next: string) => void;
    /** 1-based, to match what the pagination control shows. */
    page: number;
    onPageChange: (next: number) => void;
}) {
    const apiRef = React.useRef<GridApi<Row> | null>(null);
    // Applying the restored sort and page fires the grid's own change events;
    // without this they would immediately write the defaults back to the URL.
    const restoring = React.useRef(true);

    const onGridReady = React.useCallback((event: GridReadyEvent<Row>) => {
        apiRef.current = event.api;
        // The grid may mount after the reader has already typed.
        event.api.setGridOption('quickFilterText', query);

        const [colId, direction] = sort.split(':');
        if (colId && (direction === 'asc' || direction === 'desc')) {
            event.api.applyColumnState({ state: [{ colId, sort: direction }], defaultState: { sort: null } });
        }
        if (page > 1) event.api.paginationGoToPage(page - 1);

        // Let the restore-triggered events drain before listening for real ones.
        requestAnimationFrame(() => { restoring.current = false; });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSortChanged = React.useCallback((event: SortChangedEvent<Row>) => {
        if (restoring.current) return;
        const sorted = event.api.getColumnState().find((column) => column.sort);
        onSortChange(sorted?.sort ? `${sorted.colId}:${sorted.sort}` : '');
    }, [onSortChange]);

    const handlePaginationChanged = React.useCallback((event: PaginationChangedEvent<Row>) => {
        if (restoring.current) return;
        onPageChange(event.api.paginationGetCurrentPage() + 1);
    }, [onPageChange]);

    // AG Grid's quick filter is imperative, so the input drives it through the
    // api rather than by re-rendering the grid with different rows.
    React.useEffect(() => {
        apiRef.current?.setGridOption('quickFilterText', query);
    }, [query]);

    const defaultColDef = React.useMemo<ColDef<Row>>(
        () => ({
            sortable: true,
            resizable: true,
            // Column menus and floating filters are deliberately off: the quick
            // search covers admin needs, and per-column menus add chrome that
            // fights the panel's clean look.
            suppressHeaderMenuButton: true,
            filter: false,
            cellClass: 'text-sm',
        }),
        [],
    );

    const colDefs = React.useMemo<ColDef<Row>[]>(
        () =>
            columns.map(({ icon, headerAlign, headerName, ...rest }) => ({
                headerName,
                // Most columns render through a cellRenderer and have no
                // `field`, so AG Grid would fall back to the column's index as
                // its id — and an index in the URL points at a different column
                // the moment anyone reorders the list. The header text is
                // stable and unique within a list.
                colId: rest.colId ?? rest.field ?? headerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                ...rest,
                headerComponent: AdminGridHeader,
                headerComponentParams: { icon, align: headerAlign, ...rest.headerComponentParams },
            })),
        [columns],
    );

    return (
        <div
            className="overflow-hidden rounded-xl border border-ink-200 bg-white"
            style={{ height }}
        >
            <AgGridReact<Row>
                theme={adminGridTheme}
                rowData={rows}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                getRowId={(params) => getRowId(params.data)}
                onGridReady={onGridReady}
                onSortChanged={handleSortChanged}
                onPaginationChanged={handlePaginationChanged}
                pagination
                paginationPageSize={pageSize}
                paginationPageSizeSelector={[25, 50, 100]}
                suppressCellFocus
                // Rows carry links and buttons; a text selection drag
                // across them should not start a range selection.
                cellSelection={false}
                animateRows={false}
                overlayNoRowsTemplate={`<span class="text-sm text-ink-500">No matches for that search.</span>`}
            />
        </div>
    );
}

// AG Grid v33+ ships as modules that must be registered once per app. Doing it
// here means registration travels with the grid chunk itself.
ModuleRegistry.registerModules([AllCommunityModule]);
