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
    height?: number;
    /** "colId:asc" / "colId:desc", or '' for the grid's natural order. */
    sort: string;
    onSortChange: (next: string) => void;
    /** 1-based, to match what the pagination control shows. */
    page: number;
    onPageChange: (next: number) => void;
}) {
    const apiRef = React.useRef<GridApi<Row> | null>(null);
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

    React.useEffect(() => {
        apiRef.current?.setGridOption('quickFilterText', query);
    }, [query]);

    const defaultColDef = React.useMemo<ColDef<Row>>(
        () => ({
            sortable: true,
            resizable: true,
            suppressHeaderMenuButton: true,
            filter: false,
            cellClass: 'portal-text-body',
        }),
        [],
    );

    const colDefs = React.useMemo<ColDef<Row>[]>(
        () =>
            columns.map(({ icon, headerAlign, headerName, ...rest }) => ({
                headerName,
                colId: rest.colId ?? rest.field ?? headerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                ...rest,
                headerComponent: AdminGridHeader,
                headerComponentParams: { icon, align: headerAlign, ...rest.headerComponentParams },
            })),
        [columns],
    );

    return (
        <div
            className="portal-list-grid portal-surface overflow-hidden"
            style={height === undefined ? undefined : { height }}
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
                cellSelection={false}
                animateRows={false}
                overlayNoRowsTemplate={`<span class="portal-text-body text-muted-foreground">No matches for that search.</span>`}
            />
        </div>
    );
}

ModuleRegistry.registerModules([AllCommunityModule]);
