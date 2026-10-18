import { cn } from '@/utils';

export function StepIndicator({ labels, step }: { labels: string[]; step: number }) {
    return (
        <div className="mb-8 flex items-center gap-2">
            {labels.map((label, index) => {
                const stepNumber = index + 1;
                const active = stepNumber === step;
                const done = stepNumber < step;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <span
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                                'flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                                done && 'bg-success text-primary-foreground',
                                active && 'bg-primary text-primary-foreground',
                                !done && !active && 'bg-secondary text-muted-foreground',
                            )}
                        >
                            {stepNumber}
                        </span>
                        <span
                            className={cn(
                                'text-xs font-semibold',
                                active && 'text-foreground',
                                done && 'text-foreground/70',
                                !done && !active && 'text-muted-foreground',
                            )}
                        >
                            {label}
                        </span>
                        {}
                        {stepNumber < labels.length && (
                            <span className={cn('mx-1 h-px w-6', done ? 'bg-success/40' : 'bg-border')} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
