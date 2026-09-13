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
        <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-lg bg-ink-50 p-1">
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
                            'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                            active
                                ? 'bg-white text-ink-900 shadow-sm'
                                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700',
                        )}
                    >
                        {option.label}
                        {option.count != null && (
                            <span className={cn('ml-1.5 text-xs', active ? 'text-ink-400' : 'text-ink-400')}>
                                {option.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
