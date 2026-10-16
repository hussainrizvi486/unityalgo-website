import { cn } from '@/utils';

const PALETTE = [
    'bg-primary/10 text-primary',
    'bg-success/10 text-success',
    'bg-warning/10 text-warning',
    'bg-destructive/10 text-destructive',
    'bg-accent text-primary',
];

function colorFor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
}

export function AvatarInitials({ name, className }: { name: string; className?: string }) {
    const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?';

    return (
        <span
            className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full portal-text-caption font-semibold',
                colorFor(name || '?'),
                className
            )}
        >
            {initials}
        </span>
    );
}
