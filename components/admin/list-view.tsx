'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUrlParam } from '@/lib/use-url-param';
import type { ListViewProps } from '@/components/admin/list-view-types';

export {
    renderedColumn,
    type ListViewColumn,
    type ListViewProps,
} from '@/components/admin/list-view-types';

/**
 * The admin panel's list view: a searchable, sortable, paginated grid.
 *
 * One component behind every `/admin/*` list so they cannot drift apart. Pages
 * supply rows and column definitions; everything else — sorting, resizing,
 * quick search, pagination, the empty state — is handled here.
 *
 * Data arrives already fetched from the server component that renders this, so
 * the grid uses the client-side row model: sorting and filtering apply to the
 * whole set, not just the visible page. Lists that could grow without bound
 * cap their query and say so above the grid.
 *
 * The grid itself is loaded on demand. AG Grid is ~1.1MB and most routes under
 * /admin render a list, so the bundler was hoisting it into the layout's shared
 * chunk and every form page paid for a grid it never showed. The toolbar and
 * empty state stay in this file, so a list with no rows never fetches it at all.
 */
const ListViewGrid = dynamic(
    () => import('@/components/admin/list-view-grid').then((m) => m.ListViewGrid),
    {
        ssr: false,
        loading: () => (
            <div className="portal-grid-loading animate-pulse portal-surface" />
        ),
    },
) as <Row>(props: {
    rows: Row[];
    columns: ListViewProps<Row>['columns'];
    getRowId: (row: Row) => string;
    query: string;
    pageSize: number;
    height?: number;
    sort: string;
    onSortChange: (next: string) => void;
    page: number;
    onPageChange: (next: number) => void;
}) => React.ReactElement;

export function AdminListView<Row>({
    rows,
    columns,
    getRowId,
    searchPlaceholder,
    toolbar,
    emptyTitle = 'Nothing here yet',
    emptyMessage,
    emptyIcon,
    emptyAction,
    pageSize = 50,
    height,
    className,
}: ListViewProps<Row>) {
    // Search is debounced: it is written per keystroke, and an address-bar
    // update on every character is both wasteful and jarring to read.
    const [query, setQuery] = useUrlParam('q', '', { debounceMs: 300 });
    const [sort, setSort] = useUrlParam('sort', '');
    const [page, setPage] = useUrlParam('page', '1');

    const isEmpty = rows.length === 0;
    const isFiltered = query.trim().length > 0;

    return (
        <div className={className}>
            {(searchPlaceholder || toolbar) && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    {searchPlaceholder && (
                        <div className="relative min-w-56 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                className="pl-9 pr-9"
                            />
                            {isFiltered && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    aria-label="Clear search"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                    {toolbar}
                </div>
            )}

            {isEmpty ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-6 text-center">
                    {emptyIcon ?? null}
                    <h2 className="mt-4 text-lg font-bold text-ink-900">{emptyTitle}</h2>
                    {emptyMessage && <p className="mt-2 max-w-sm portal-text-body text-ink-500">{emptyMessage}</p>}
                    {emptyAction && (
                        <Button asChild className=""><Link href={emptyAction.href} className="mt-5">
                                {emptyAction.label}
                            </Link></Button>
                    )}
                </div>
            ) : (
                <ListViewGrid
                    rows={rows}
                    columns={columns}
                    getRowId={getRowId}
                    query={query}
                    pageSize={pageSize}
                    height={height}
                    sort={sort}
                    onSortChange={setSort}
                    page={Number(page) || 1}
                    onPageChange={(next) => setPage(String(next))}
                />
            )}
        </div>
    );
}
