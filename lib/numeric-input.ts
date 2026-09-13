import { formatCurrencyAmount, patternParts } from '@/lib/currency';

/**
 * The parsing and formatting rules behind `<SmartInput>`.
 *
 * Kept out of the component so they can be exercised directly — the awkward
 * cases here are string handling, not React.
 */

export type NumericKind = 'integer' | 'decimal' | 'currency' | 'percent';
export type SmartInputKind = 'text' | NumericKind;

export interface NumericOptions {
    kind: NumericKind;
    /** Drives grouping, decimal separator and precision for `currency`. */
    numberFormat?: string | null;
    symbol?: string | null;
    /** Overrides the pattern's precision. Ignored by `integer`. */
    decimals?: number;
    /** Off by default: prices, ports and quantities are the common cases. */
    allowNegative?: boolean;
}

/**
 * The precision to pad to, or null to keep whatever was entered.
 *
 * Money is padded because prices are written that way — $5 reads as unfinished
 * where $5.00 does not. A plain number is not: padding a quantity of 12 to
 * "12.00" invents a precision the person did not type. Anything can be pinned
 * by passing `decimals` explicitly.
 */
function precisionOf(options: NumericOptions): number | null {
    if (options.kind === 'integer') return 0;
    if (options.decimals != null) return options.decimals;
    if (options.kind === 'currency') return patternParts(options.numberFormat).decimals;
    return null;
}

function separatorsOf(options: NumericOptions) {
    // Only currency follows a configured pattern; plain numbers and percents
    // use the conventional comma/point so a form does not change shape
    // depending on which currency happens to be selected elsewhere.
    if (options.kind === 'currency') {
        const { groupSep, decimalSep } = patternParts(options.numberFormat);
        return { groupSep, decimalSep };
    }
    return { groupSep: ',', decimalSep: '.' };
}

/**
 * Strips a typed or pasted string down to a canonical number string.
 *
 * Canonical means what a server should receive: no grouping, `.` for the
 * decimal point, no symbol. Returns '' for anything with no digits, so an
 * emptied field posts empty rather than `0` — the difference between "no
 * price" and "free".
 */
export function toCanonical(raw: string, options: NumericOptions): string {
    const { groupSep, decimalSep } = separatorsOf(options);
    const negative = options.allowNegative === true && /^\s*-/.test(raw);

    // Remove the group separator first: in a European pattern it is a dot, and
    // treating it as a decimal point would divide the number by a thousand.
    let body = raw.split(groupSep).join('');
    if (decimalSep !== '.') body = body.split(decimalSep).join('.');
    body = body.replace(/[^0-9.]/g, '');

    if (options.kind === 'integer') {
        body = body.split('.')[0] ?? '';
    } else {
        // Keep only the first decimal point; later ones are typing noise.
        const [whole = '', ...rest] = body.split('.');
        body = rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
    }

    if (body === '' || body === '.') return '';
    return (negative ? '-' : '') + body;
}

/**
 * Reads a value that came from the server, which is already canonical.
 *
 * This is deliberately not `toCanonical`. That function parses what a person
 * typed, using the separators the field displays — correct for input, wrong
 * for storage. A stored amount always writes its decimal point as `.`, so in a
 * "#.###,##" currency `toCanonical` would read `1234567.89` as a grouped
 * `123456789`, silently multiplying the price by a hundred.
 *
 * Anything that is not already canonical — a pasted, formatted string — still
 * falls through to `toCanonical`, since that is exactly what it is for.
 */
export function fromStored(
    value: string | number | null | undefined,
    options: NumericOptions,
): string {
    if (value == null) return '';
    const text = String(value).trim();
    if (text === '') return '';
    if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return toCanonical(text, options);

    const negative = text.startsWith('-');
    let body = negative ? text.slice(1) : text;
    if (options.kind === 'integer') body = body.split('.')[0] ?? '';
    if (body === '') return '';
    return negative && options.allowNegative === true ? `-${body}` : body;
}

/** Whether a canonical string is a complete, usable number. */
export function toNumber(canonical: string): number | null {
    if (canonical === '' || canonical === '-' || canonical.endsWith('.')) return null;
    const value = Number(canonical);
    return Number.isFinite(value) ? value : null;
}

/**
 * What the field shows when it is not being edited.
 *
 * Editing shows the canonical string instead: grouping separators moving
 * around under the cursor is the single most irritating thing a formatted
 * input can do, so formatting is applied on blur and removed on focus.
 */
export function toDisplay(canonical: string, options: NumericOptions): string {
    const value = toNumber(canonical);
    if (value == null) return canonical;

    if (options.kind === 'currency') {
        return formatCurrencyAmount(value, {
            symbol: options.symbol ?? '',
            numberFormat: options.numberFormat ?? '',
        });
    }

    const decimals = precisionOf(options);
    let whole: string;
    let fraction: string | undefined;

    if (decimals != null) {
        [whole = '', fraction] = Math.abs(value).toFixed(decimals).split('.');
    } else {
        // Split the canonical string rather than the number, so "12.50" keeps
        // the zero the person typed instead of coming back as "12.5".
        const bare = canonical.startsWith('-') ? canonical.slice(1) : canonical;
        [whole = '', fraction] = bare.split('.');
        if (whole === '') whole = '0';
    }

    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const body = grouped + (fraction ? `.${fraction}` : '');
    const signed = `${value < 0 ? '-' : ''}${body}`;
    return options.kind === 'percent' ? `${signed}%` : signed;
}

export interface RangeRule {
    min?: number;
    max?: number;
    required?: boolean;
}

/** The message to show, or null when the value is acceptable. */
export function validateNumeric(
    canonical: string,
    options: NumericOptions,
    rule: RangeRule = {},
): string | null {
    if (canonical === '') return rule.required ? 'This field is required.' : null;

    const value = toNumber(canonical);
    if (value == null) return 'Enter a complete number.';
    if (rule.min != null && value < rule.min) return `Must be ${rule.min} or more.`;
    if (rule.max != null && value > rule.max) return `Must be ${rule.max} or less.`;
    if (options.kind === 'integer' && !Number.isInteger(value)) return 'Must be a whole number.';
    return null;
}
