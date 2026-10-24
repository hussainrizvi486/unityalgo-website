'use client';

import * as React from 'react';
import { Boxes, GitBranch, Layers, Tag } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlParam } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import { ActionsCell, BadgeCell, StackedCell, type ActionsValue, type BadgeValue, type StackedValue } from '@/components/admin/grid-cells';
import { compatibilityBadge, shortSha } from '@/lib/app-store';

export interface AppRow {
    id: string;
    name: string;
    slug: string;
    category: string;
    frappeAppName: string | null;
    appType: 'application' | 'module';
    modules: string[];
    source: 'github' | 'image';
    repo: string | null;
    branch: string | null;
    version: string | null;
    commit: string | null;
    compatibility: string | null;
    installedOn: number;
    behind: number;
    tracked: boolean;
    visible: boolean;
    checked: string | null;
}

const FILTERS = ['all', 'github', 'image', 'updates', 'hidden'] as const;
type Filter = (typeof FILTERS)[number];

export function AppsList({ rows }: { rows: AppRow[] }) {
    const [filter, setFilter] = useUrlParam('show', 'all');
    const visible = React.useMemo(
        () =>
            filter === 'github' ? rows.filter((row) => row.source === 'github')
            : filter === 'image' ? rows.filter((row) => row.source === 'image')
            : filter === 'updates' ? rows.filter((row) => row.behind > 0)
            : filter === 'hidden' ? rows.filter((row) => !row.visible)
            : rows,
        [rows, filter],
    );

    const columns: ListViewColumn<AppRow>[] = [
        renderedColumn<AppRow, StackedValue>({
            headerName: 'Application',
            icon: <Boxes />,
            flex: 1.5,
            minWidth: 230,
            cellRenderer: StackedCell,
            text: (row) => `${row.name} ${row.slug} ${row.frappeAppName ?? ''} ${row.category}`,
            get: (row) => ({ primary: row.name, secondary: `${row.category}${row.appType === 'module' ? ` · Module (${row.modules.length})` : row.frappeAppName ? ` · ${row.frappeAppName}` : ''}`, href: `/admin/apps/${row.id}` }),
        }),
        renderedColumn<AppRow, StackedValue>({
            headerName: 'Source',
            icon: <GitBranch />,
            flex: 1.2,
            minWidth: 200,
            cellRenderer: StackedCell,
            text: (row) => `${row.repo ?? 'built in'} ${row.branch ?? ''}`,
            get: (row) => row.source === 'github'
                ? { primary: row.repo, secondary: row.branch ? `Branch ${row.branch}` : undefined }
                : { primary: 'Built into the Frappe image', secondary: 'Updated with the platform image' },
        }),
        renderedColumn<AppRow, StackedValue>({
            headerName: 'Latest version',
            icon: <Tag />,
            width: 170,
            cellRenderer: StackedCell,
            text: (row) => `${row.version ?? ''} ${row.commit ?? ''}`,
            get: (row) => row.source === 'github'
                ? { primary: row.version ?? shortSha(row.commit), secondary: row.commit ? shortSha(row.commit) : 'Not checked yet' }
                : { primary: '—' },
        }),
        renderedColumn<AppRow, BadgeValue>({
            headerName: 'Frappe',
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => compatibilityBadge(row.compatibility).label,
            get: (row) => row.source === 'github' ? compatibilityBadge(row.compatibility) : { label: 'Bundled', variant: 'neutral' },
        }),
        renderedColumn<AppRow, StackedValue>({
            headerName: 'Installed on',
            icon: <Layers />,
            width: 170,
            cellRenderer: StackedCell,
            text: (row) => String(row.installedOn),
            get: (row) => !row.tracked
                ? { primary: '—', secondary: 'Controller offline' }
                : { primary: `${row.installedOn} site${row.installedOn === 1 ? '' : 's'}`, secondary: row.behind ? `${row.behind} behind latest` : row.installedOn ? 'All current' : undefined },
        }),
        renderedColumn<AppRow, BadgeValue>({
            headerName: 'Visibility',
            width: 130,
            cellRenderer: BadgeCell,
            text: (row) => (row.visible ? 'Visible' : 'Hidden'),
            get: (row) => (row.visible ? { label: 'Visible', variant: 'success' } : { label: 'Hidden', variant: 'neutral' }),
        }),
        renderedColumn<AppRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 130,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({ actions: [{ label: 'Manage', href: `/admin/apps/${row.id}` }] }),
        }),
    ];

    const count = (test: (row: AppRow) => boolean) => rows.filter(test).length;
    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search applications, repositories or categories…"
            toolbar={
                <FilterPills<Filter>
                    label="Filter applications"
                    value={(FILTERS as readonly string[]).includes(filter) ? (filter as Filter) : 'all'}
                    onChange={setFilter}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        { value: 'github', label: 'GitHub', count: count((r) => r.source === 'github') },
                        { value: 'image', label: 'Built in', count: count((r) => r.source === 'image') },
                        { value: 'updates', label: 'Updates available', count: count((r) => r.behind > 0) },
                        { value: 'hidden', label: 'Hidden', count: count((r) => !r.visible) },
                    ]}
                />
            }
            emptyIcon={<Boxes className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle="No applications"
            emptyMessage="Add a Frappe app from GitHub to offer it on customer sites."
        />
    );
}
