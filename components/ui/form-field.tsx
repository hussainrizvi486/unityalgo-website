import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils';

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
            <Label htmlFor={id} className="mb-1.5 text-sm text-foreground/80">
                {label}
                {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
            </Label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-destructive">
                    {error}
                </p>
            ) : help ? (
                <p id={`${id}-help`} className="mt-1.5 text-xs text-muted-foreground">
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
