import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils';

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
