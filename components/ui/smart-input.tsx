'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
    fromStored, toCanonical, toDisplay, toNumber, validateNumeric,
    type NumericOptions, type SmartInputKind,
} from '@/lib/numeric-input';
import { cn } from '@/utils';

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
        numeric ? fromStored(defaultValue, options) : (defaultValue == null ? '' : String(defaultValue)),
    );
    const [editing, setEditing] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const error = numeric && touched
        ? validateNumeric(canonical, options, { min, max, required })
        : null;

    const shown = !numeric || editing ? canonical : toDisplay(canonical, options);

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
