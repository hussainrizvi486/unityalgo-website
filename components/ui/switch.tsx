'use client';

import * as React from 'react';
import { cn } from '@/utils';

/**
 * A binary toggle that applies immediately.
 *
 * A switch is not a checkbox. A checkbox is a value you are proposing, which
 * takes effect when the form is submitted; a switch takes effect the moment it
 * is thrown. Use `<Checkbox>` inside a form that has a Save button, and this
 * where the change is the action — a billing period, a live/paused state, a
 * preference that persists on its own.
 *
 * Built on a plain button rather than another Radix package: the whole of a
 * switch is `role="switch"`, `aria-checked`, and moving a knob 24px. Space and
 * Enter come free with the button element.
 */

export interface SwitchProps
    extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'type' | 'children'> {
    /** Controlled state. Pair with `onCheckedChange`. */
    checked?: boolean;
    /** Uncontrolled starting state. */
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    /**
     * Posts `on` with the form when checked, and nothing at all when not —
     * the same shape a native checkbox has, so server actions can keep reading
     * `formData.get(name) === 'on'`.
     */
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

// The knob travels the track's inner width minus its own width. Both are fixed,
// so the distance is a constant rather than something to measure at runtime.
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
                        ? 'focus-visible:ring-[3px] focus-visible:ring-white/40'
                        : 'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    dark
                        ? on ? 'bg-white' : 'bg-white/25'
                        : on ? 'bg-ink-950' : 'bg-ink-200',
                    className,
                )}
            >
                <span
                    className={cn(
                        'pointer-events-none inline-block transform rounded-full shadow-md ring-0',
                        'transition duration-200 ease-in-out',
                        KNOB[size],
                        on ? TRAVEL[size] : 'translate-x-0',
                        // On a dark ground the track turns white when on, so a
                        // white knob would disappear into it.
                        dark && on ? 'bg-ink-950' : 'bg-white',
                    )}
                />
            </button>

            {/* Absent when off, exactly like an unchecked checkbox. */}
            {name && on ? <input type="hidden" name={name} value="on" /> : null}
        </>
    );
});

export { Switch };
