import { cn } from '@/utils';

const PALETTE = [
    'bg-info-50 text-info-600',
    'bg-success-50 text-success-600',
    'bg-warning-50 text-warning-700',
    'bg-error-50 text-error-700',
    'bg-accent text-brand',
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
