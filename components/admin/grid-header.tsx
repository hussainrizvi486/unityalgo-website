'use client';

import * as React from 'react';
import type { IHeaderParams } from 'ag-grid-community';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils';

export interface AdminHeaderParams extends IHeaderParams {
    /** Rendered before the label, matching the old table's icon headers. */
    icon?: React.ReactNode;
    align?: 'left' | 'right';
}

export function AdminGridHeader(params: AdminHeaderParams) {
    const { displayName, enableSorting, column, icon, align = 'left' } = params;
    const [sort, setSort] = React.useState<'asc' | 'desc' | null>(() => column.getSort() ?? null);

    React.useEffect(() => {
        const onChanged = () => setSort(column.getSort() ?? null);
        column.addEventListener('sortChanged', onChanged);
        return () => column.removeEventListener('sortChanged', onChanged);
    }, [column]);

    const label = (
        <>
            {icon && <span className="[&_svg]:size-4 [&_svg]:text-muted-foreground shrink-0">{icon}</span>}
            <span className="truncate">{displayName}</span>
        </>
    );

    if (!enableSorting) {
        return (
            <div
                className={cn(
                    'flex w-full items-center gap-2 portal-text-body font-medium text-muted-foreground',
                    align === 'right' && 'justify-end',
                )}
            >
                {label}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={(event) => params.progressSort(event.shiftKey)}
            className={cn(
                'group flex w-full items-center gap-2 portal-text-body font-medium text-muted-foreground transition-colors hover:text-foreground',
                align === 'right' && 'justify-end',
            )}
        >
            {label}
            {sort === 'asc' ? (
                <ArrowUp className="size-3.5 shrink-0 text-foreground/80" />
            ) : sort === 'desc' ? (
                <ArrowDown className="size-3.5 shrink-0 text-foreground/80" />
            ) : (
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
        </button>
    );
}
