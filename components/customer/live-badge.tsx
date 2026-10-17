import { cn } from '@/utils';

/** Small "Live" marker: the page is receiving updates on its own. */
export function LiveBadge({ connection, className }: { connection: 'connecting' | 'live' | 'reconnecting'; className?: string }) {
    const live = connection === 'live';
    return (
        <p role="status" className={cn('inline-flex items-center gap-2 portal-text-caption text-muted-foreground', className)}>
            <span className="relative flex size-2">
                {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50 motion-reduce:animate-none" />}
                <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-success' : 'bg-warning')} />
            </span>
            {live ? 'Live — this page updates automatically' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </p>
    );
}
