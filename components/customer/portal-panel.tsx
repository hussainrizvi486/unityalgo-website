import type { ComponentProps } from 'react';
import { cn } from '@/utils';

/** Shared surface for customer cards and settings panels. */
export function PortalPanel({
    className,
    padding = 'default',
    ...props
}: ComponentProps<'section'> & { padding?: 'default' | 'none' }) {
    return (
        <section
            data-slot="portal-panel"
            data-padding={padding}
            className={cn('min-w-0', className)}
            {...props}
        />
    );
}
