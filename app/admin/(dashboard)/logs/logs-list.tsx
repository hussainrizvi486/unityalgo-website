'use client';

import * as React from 'react';
import { Activity, CalendarClock, Tag, User as UserIcon } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    BadgeCell, ClampedCell, MutedCell, StackedCell,
    type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface LogRow {
    id: string;
    /** Operation name, or event action. */
    title: string;
    subtitle: string;
    target: string;
    /** Operations only. */
    actor?: string;
    started?: string;
    /** Events only. */
    message?: string;
    category: string;
    statusLabel: string;
    statusVariant: BadgeVariant;
}

/**
 * The activity log, in either of its two shapes.
 *
 * Operations are end-to-end processes; events are the individual steps within
 * them, plus standalone ones like health sweeps. Both are lists of the same
 * shape, so one component renders either — the column set is what differs.
 */
export function LogsList({
    view,
    rows,
    categories,
}: {
    view: 'operations' | 'events';
    rows: LogRow[];
    categories: string[];
}) {
    const [category, setCategory] = useUrlParam('category', 'all');
    const visible = React.useMemo(
        () => (category === 'all' ? rows : rows.filter((row) => row.category === category)),
        [rows, category],
    );

    const titleColumn = renderedColumn<LogRow, StackedValue>({
        headerName: view === 'operations' ? 'Operation' : 'Action',
        icon: <Activity />,
        flex: 1.6,
        minWidth: 230,
        cellRenderer: StackedCell,
        text: (row) => `${row.title} ${row.category}`,
        get: (row) => ({ primary: row.title, secondary: row.subtitle }),
    });

    const targetColumn: ListViewColumn<LogRow> = {
        headerName: 'Target',
        icon: <Tag />,
        flex: 1,
        minWidth: 150,
        cellRenderer: MutedCell,
        valueGetter: (p) => p.data?.target,
    };

    const statusColumn = renderedColumn<LogRow, BadgeValue>({
        headerName: 'Status',
        headerAlign: 'right',
        width: 150,
        resizable: false,
        pinned: 'right',
        cellClass: 'justify-end',
        cellRenderer: BadgeCell,
        text: (row) => row.statusLabel,
        get: (row) => ({ label: row.statusLabel, variant: row.statusVariant }),
    });

    const columns: ListViewColumn<LogRow>[] =
        view === 'operations'
            ? [
                  titleColumn,
                  targetColumn,
                  {
                      headerName: 'Actor',
                      icon: <UserIcon />,
                      flex: 1,
                      minWidth: 150,
                      cellRenderer: MutedCell,
                      valueGetter: (p) => p.data?.actor,
                  },
                  {
                      headerName: 'Started',
                      icon: <CalendarClock />,
                      width: 190,
                      cellRenderer: MutedCell,
                      valueGetter: (p) => p.data?.started,
                  },
                  statusColumn,
              ]
            : [
                  titleColumn,
                  targetColumn,
                  {
                      headerName: 'Message',
                      flex: 2,
                      minWidth: 220,
                      cellRenderer: ClampedCell,
                      valueGetter: (p) => p.data?.message,
                  },
                  statusColumn,
              ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder={
                view === 'operations' ? 'Search operations…' : 'Search events by action or message…'
            }
            toolbar={
                <FilterPills
                    label="Filter by category"
                    value={category}
                    onChange={setCategory}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        ...categories.map((value) => ({
                            value,
                            label: value.charAt(0).toUpperCase() + value.slice(1),
                            count: rows.filter((r) => r.category === value).length,
                        })),
                    ]}
                />
            }
            emptyIcon={<Activity className="h-10 w-10 text-ink-300" />}
            emptyTitle={view === 'operations' ? 'No operations recorded yet' : 'No events recorded yet'}
            emptyMessage="Provisioning, migrations, backups and health checks all record their steps here."
        />
    );
}
