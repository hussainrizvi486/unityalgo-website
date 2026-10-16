'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
    fromStored, toCanonical, toDisplay, toNumber, validateNumeric,
    type NumericOptions, type SmartInputKind,
} from '@/lib/numeric-input';
import { cn } from '@/utils';

/**
 * One text field for text, whole numbers, decimals, currency and percentages.
 *
 * It is always `type="text"`. `type="number"` cannot be formatted — no
 * grouping separators, no symbol — and brings problems of its own: the value
 * changes when the wheel is scrolled over it, and an entry the browser
 * considers invalid comes back as an empty string, so there is no way to tell
 * a cleared field from a mistyped one.
 *
 * Two inputs are rendered. The visible one is what a person reads and edits;
 * a hidden one carries `name` and always holds the canonical value, so a
 * server action receives `1234.56` no matter what the field is displaying.
 * Nothing downstream has to know a field was formatted.
 *
 * Formatting appears on blur and disappears on focus. Regrouping digits while
 * someone is typing moves the caret out from under them, which is the single
 * most irritating thing a formatted input can do.
 */

export interface SmartInputProps
    extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'> {
    name: string;
    kind?: SmartInputKind;
    defaultValue?: string | number | null;
    /** Currency pattern, e.g. "#,##,###.##". Drives grouping and precision. */
    numberFormat?: string | null;
    /** Prefix shown when not editing, e.g. "$". */
    symbol?: string | null;
    /** Overrides the pattern's precision. Ignored for whole numbers. */
    decimals?: number;
    allowNegative?: boolean;
    min?: number;
    max?: number;
    /** Called with the canonical string on every edit. */
    onValueChange?: (canonical: string) => void;
}

export function SmartInput({
    name,
    kind = 'text',
    defaultValue,
    numberFormat,
    symbol,
    decimals,
    allowNegative = false,
    min,
    max,
    required,
    className,
    onValueChange,
    ...rest
}: SmartInputProps) {
    const numeric = kind !== 'text';
    const options = React.useMemo<NumericOptions>(
        () => ({
            kind: numeric ? kind : 'decimal',
            numberFormat,
            symbol,
            decimals,
            allowNegative,
        }),
        [kind, numeric, numberFormat, symbol, decimals, allowNegative],
    );

    const [canonical, setCanonical] = React.useState(() =>
        // The incoming value is what the server stored, not what someone typed,
        // so it is read as canonical rather than through the display locale.
        numeric ? fromStored(defaultValue, options) : (defaultValue == null ? '' : String(defaultValue)),
    );
    const [editing, setEditing] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const error = numeric && touched
        ? validateNumeric(canonical, options, { min, max, required })
        : null;

    const shown = !numeric || editing ? canonical : toDisplay(canonical, options);

    // Focusing swaps "$1,234.50" for "1234.5". Writing that shorter string into
    // the DOM node collapses the selection to the end of it, so the caret is no
    // longer where the click put it and anything typed next is appended to the
    // old value instead of replacing it. Selecting the whole value settles both
    // problems, and these fields are short enough that select-on-focus is what
    // people expect anyway.
    //
    // This has to be a layout effect, not a frame later: it must run in the same
    // synchronous commit that writes the new string, before the browser delivers
    // the next keystroke. The focus check matters because select() also focuses,
    // and a stale call would drag focus back out of wherever it had moved on to.
    React.useLayoutEffect(() => {
        if (!numeric || !editing) return;
        const element = inputRef.current;
        if (element && document.activeElement === element) element.select();
    }, [numeric, editing]);

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const next = numeric ? toCanonical(event.target.value, options) : event.target.value;
        setCanonical(next);
        onValueChange?.(next);
    }

    return (
        <>
            <Input
                {...rest}
                type="text"
                // No `name`: the visible field may be showing "$1,234.56", and
                // that is not what the server should receive.
                value={shown}
                onChange={handleChange}
                ref={inputRef}
                onFocus={(event) => { setEditing(true); rest.onFocus?.(event); }}
                onBlur={(event) => { setEditing(false); setTouched(true); rest.onBlur?.(event); }}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${name}-error` : rest['aria-describedby']}
                // Numeric keypad on a phone, without the type="number" problems.
                inputMode={numeric ? (kind === 'integer' ? 'numeric' : 'decimal') : undefined}
                autoComplete={rest.autoComplete ?? (numeric ? 'off' : undefined)}
                className={cn(numeric && 'tabular-nums', className)}
            />
            <input type="hidden" name={name} value={canonical} />
            {error ? (
                <p id={`${name}-error`} role="alert" className="mt-1.5 text-xs text-destructive">
                    {error}
                </p>
            ) : null}
        </>
    );
}

/** Re-exported so a caller can validate the same way before submitting. */
export { toNumber };
