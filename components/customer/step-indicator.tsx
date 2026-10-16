import { cn } from '@/utils';

/**
 * The numbered progress row above the auth flows.
 *
 * Shared because register and forgot-password had byte-identical copies of it
 * apart from the labels, so any change to one silently made the two flows look
 * different from each other.
 *
 * Colour carries state: blue for where you are, green for what you have
 * finished, grey for what is ahead. Position and label weight say the same
 * thing, so the meaning survives a colour-vision deficiency.
 */
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
                                // success-600 and link, not the 500-weight green
                                // and blue: white on success-500 is 3.3:1 and on
                                // info-500 is 3.1:1, both short of 4.5:1 at this
                                // size. These clear 5:1.
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
                        {/* The connector carries the progress too, so the line
                            behind you reads as covered ground. */}
                        {stepNumber < labels.length && (
                            <span className={cn('mx-1 h-px w-6', done ? 'bg-success/40' : 'bg-border')} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
