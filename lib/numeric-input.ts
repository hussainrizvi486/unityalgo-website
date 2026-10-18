import { formatCurrencyAmount, patternParts } from '@/lib/currency';

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

function precisionOf(options: NumericOptions): number | null {
    if (options.kind === 'integer') return 0;
    if (options.decimals != null) return options.decimals;
    if (options.kind === 'currency') return patternParts(options.numberFormat).decimals;
    return null;
}

function separatorsOf(options: NumericOptions) {
    if (options.kind === 'currency') {
        const { groupSep, decimalSep } = patternParts(options.numberFormat);
        return { groupSep, decimalSep };
    }
    return { groupSep: ',', decimalSep: '.' };
}

export function toCanonical(raw: string, options: NumericOptions): string {
    const { groupSep, decimalSep } = separatorsOf(options);
    const negative = options.allowNegative === true && /^\s*-/.test(raw);

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
