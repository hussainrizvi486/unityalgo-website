'use client';

import * as React from 'react';
import { CalendarClock, CircleCheck, FileText } from 'lucide-react';
import { AdminListView, renderedColumn, type ListViewColumn } from '@/components/admin/list-view';
import { useUrlEnum } from '@/lib/use-url-param';
import { FilterPills } from '@/components/admin/filter-pills';
import {
    ActionsCell, BadgeCell, MutedCell, StackedCell,
    type ActionsValue, type BadgeValue, type StackedValue,
} from '@/components/admin/grid-cells';

export interface BlogRow {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    updated: string;
}

export function BlogsList({
    rows,
    togglePublishAction,
    deleteAction,
}: {
    rows: BlogRow[];
    togglePublishAction: (formData: FormData) => Promise<void>;
    deleteAction: (formData: FormData) => Promise<void>;
}) {
    const [status, setStatus] = useUrlEnum('status', ['all', 'published', 'draft'] as const, 'all');
    const visible = React.useMemo(
        () =>
            status === 'all'
                ? rows
                : rows.filter((row) => (status === 'published' ? row.published : !row.published)),
        [rows, status],
    );

    const columns: ListViewColumn<BlogRow>[] = [
        renderedColumn<BlogRow, StackedValue>({
            headerName: 'Title',
            icon: <FileText />,
            flex: 2,
            minWidth: 260,
            cellRenderer: StackedCell,
            text: (row) => `${row.title} ${row.slug}`,
            get: (row) => ({
                primary: row.title,
                secondary: `/blog/${row.slug}`,
                href: `/admin/blogs/${row.id}/edit`,
            }),
        }),
        renderedColumn<BlogRow, BadgeValue>({
            headerName: 'Status',
            icon: <CircleCheck />,
            width: 150,
            cellRenderer: BadgeCell,
            text: (row) => (row.published ? 'Published' : 'Draft'),
            get: (row) => ({
                label: row.published ? 'Published' : 'Draft',
                variant: row.published ? 'success' : 'neutral',
            }),
        }),
        {
            headerName: 'Updated',
            icon: <CalendarClock />,
            width: 170,
            cellRenderer: MutedCell,
            valueGetter: (p) => p.data?.updated,
        },
        renderedColumn<BlogRow, ActionsValue>({
            headerName: 'Actions',
            headerAlign: 'right',
            width: 290,
            sortable: false,
            resizable: false,
            pinned: 'right',
            cellRenderer: ActionsCell,
            get: (row) => ({
                actions: [{ label: 'Edit', href: `/admin/blogs/${row.id}/edit` }],
                submits: [{
                    label: row.published ? 'Unpublish' : 'Publish',
                    action: togglePublishAction,
                    id: row.id,
                }],
                remove: {
                    action: deleteAction,
                    id: row.id,
                    title: 'Delete this post?',
                    description: `"${row.title}" will be permanently deleted. This action cannot be undone.`,
                },
            }),
        }),
    ];

    return (
        <AdminListView
            rows={visible}
            columns={columns}
            getRowId={(row) => row.id}
            searchPlaceholder="Search posts by title or slug…"
            toolbar={
                <FilterPills
                    label="Filter by status"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: 'all', label: 'All', count: rows.length },
                        { value: 'published', label: 'Published', count: rows.filter((r) => r.published).length },
                        { value: 'draft', label: 'Drafts', count: rows.filter((r) => !r.published).length },
                    ]}
                />
            }
            emptyIcon={<FileText className="h-10 w-10 text-ink-300" />}
            emptyTitle="No blog posts yet"
            emptyMessage="Posts you publish appear on the public blog."
            emptyAction={{ label: 'Write a post', href: '/admin/blogs/new' }}
        />
    );
}
