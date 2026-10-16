import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils';

/**
 * The inline feedback banner above and inside forms.
 *
 * Extracted because the same four states had been hand-written roughly thirty
 * times across the app, drifting on radius (`rounded-md` vs `rounded-lg`), on
 * whether an icon was present, and on which text weight paired with which
 * fill. This is the shape the theme preview documents, in one place.
 *
 * `role` is chosen from the tone rather than passed in: an error is an alert
 * and interrupts a screen reader, a confirmation is a status and waits its
 * turn. Getting that backwards is the usual bug, so it is not a caller's
 * decision.
 */

const TONES = {
    error: { fill: 'bg-destructive/10 text-destructive', Icon: XCircle },
    success: { fill: 'bg-success/10 text-success', Icon: CheckCircle2 },
    warning: { fill: 'bg-warning/10 text-warning', Icon: AlertTriangle },
    info: { fill: 'bg-primary/10 text-primary', Icon: Info },
} as const;

export type NoticeTone = keyof typeof TONES;

export function Notice({
    tone,
    children,
    icon = true,
    className,
    ...rest
}: React.ComponentProps<'div'> & {
    tone: NoticeTone;
    /** Off for a dense context where the icon is more noise than signal. */
    icon?: boolean;
}) {
    const { fill, Icon } = TONES[tone];
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn('flex items-start gap-3 rounded-md px-3.5 py-2.5 text-sm', fill, className)}
            {...rest}
        >
            {icon && <Icon className="mt-0.5 size-4 shrink-0" />}
            <span className="min-w-0">{children}</span>
        </div>
    );
}
