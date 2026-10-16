'use client';

import * as React from 'react';
import { cn } from '@/utils';

export interface FilterOption<T extends string> {
    value: T;
    label: string;
    /** Shown as a count beside the label. */
    count?: number;
}

/**
 * A segmented control for the one-of-N filters above a list (status, product,
 * role).
 *
 * Client-side: the list already holds every row, so switching filters is
 * instant and needs no round trip. Rendered as radios rather than buttons so
 * arrow keys move between options and screen readers announce the group.
 */
export function FilterPills<T extends string>({
    options,
    value,
    onChange,
    label,
}: {
    options: FilterOption<T>[];
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'portal-filter-button font-medium transition-colors',
                            active
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground/80',
                        )}
                    >
                        {option.label}
                        {option.count != null && (
                            <span className={cn('ml-1.5 portal-text-caption', active ? 'text-muted-foreground' : 'text-muted-foreground')}>
                                {option.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
