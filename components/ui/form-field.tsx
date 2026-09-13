import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils';

/**
 * Label, control, and one line of supporting text.
 *
 * Help and error share a slot — a field shows one or the other, never both —
 * so the row below the control never changes height when validation fires.
 *
 * `error` sets aria-describedby on the child control via `describedBy`, which
 * the caller must spread. Doing it here rather than per-form keeps the wiring
 * between message and control from being forgotten.
 */
export function FormField({
    id,
    label,
    error,
    help,
    optional,
    className,
    children,
}: {
    id: string;
    label: React.ReactNode;
    error?: string | null;
    help?: React.ReactNode;
    optional?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            <Label htmlFor={id} className="mb-1.5 text-sm text-ink-700">
                {label}
                {optional && <span className="ml-1 font-normal text-ink-400">(optional)</span>}
            </Label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-error-600">
                    {error}
                </p>
            ) : help ? (
                <p id={`${id}-help`} className="mt-1.5 text-xs text-ink-500">
                    {help}
                </p>
            ) : null}
        </div>
    );
}

/** The aria attributes a control inside FormField should carry. */
export function fieldAria(id: string, error?: string | null, help?: React.ReactNode) {
    return {
        'aria-invalid': error ? (true as const) : undefined,
        'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : undefined,
    };
}
