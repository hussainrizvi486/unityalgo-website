'use client';

import * as React from 'react';
import { cn } from '@/utils';

export interface SwitchProps
    extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'type' | 'children'> {
    /** Controlled state. Pair with `onCheckedChange`. */
    checked?: boolean;
    /** Uncontrolled starting state. */
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    name?: string;
    /** Which ground it sits on. Pages here alternate white and near-black. */
    tone?: 'light' | 'dark';
    size?: 'sm' | 'default';
}

const TRACK = {
    default: 'h-7 w-13',
    sm: 'h-5 w-9',
};

const KNOB = {
    default: 'size-6',
    sm: 'size-4',
};

const TRAVEL = {
    default: 'translate-x-6',
    sm: 'translate-x-4',
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
    {
        checked,
        defaultChecked = false,
        onCheckedChange,
        name,
        tone = 'light',
        size = 'default',
        disabled,
        className,
        onClick,
        ...rest
    },
    ref,
) {
    const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
    const isControlled = checked !== undefined;
    const on = isControlled ? checked : uncontrolled;
    const dark = tone === 'dark';

    function toggle(event: React.MouseEvent<HTMLButtonElement>) {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const next = !on;
        if (!isControlled) setUncontrolled(next);
        onCheckedChange?.(next);
    }

    return (
        <>
            <button
                {...rest}
                ref={ref}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={disabled}
                onClick={toggle}
                className={cn(
                    'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                    'transition-colors duration-200 ease-in-out outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    TRACK[size],
                    dark
                        ? 'focus-visible:ring-3 focus-visible:ring-primary-foreground/40'
                        : 'focus-visible:ring-3 focus-visible:ring-ring/50',
                    dark
                        ? on ? 'bg-card' : 'bg-primary-foreground/25'
                        : on ? 'bg-primary' : 'bg-border',
                    className,
                )}
            >
                <span
                    className={cn(
                        'pointer-events-none inline-block transform rounded-full shadow-md ring-0',
                        'transition duration-200 ease-in-out',
                        KNOB[size],
                        on ? TRAVEL[size] : 'translate-x-0',
                        dark && on ? 'bg-primary' : 'bg-card',
                    )}
                />
            </button>

            {/* Absent when off, exactly like an unchecked checkbox. */}
            {name && on ? <input type="hidden" name={name} value="on" /> : null}
        </>
    );
});

export { Switch };
