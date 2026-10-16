import type { Currency } from '@/db/types';

/**
 * Formatting an amount with a currency's own grouping pattern.
 *
 * `Intl.NumberFormat` is driven by a locale, and the grouping an admin wants is
 * not always one a locale produces — the South Asian lakh/crore grouping being
 * the case that forced this. The pattern is applied directly instead, so what
 * is configured is what is rendered.
 */

/**
 * The grouping patterns the admin can choose between.
 *
 * Defined here rather than beside the server action that validates against it:
 * a `'use server'` file may only export async functions, so a plain constant
 * exported from one fails at runtime with "found object".
 */
export const NUMBER_FORMATS = ['#,###.##', '#,##,###.##', '####.##', '#.###,##'] as const;

/** Fallback when a plan has no currency, matching what Paddle charges in. */
export const DEFAULT_CURRENCY = { code: 'USD', symbol: '$', numberFormat: '#,###.##' };

type CurrencyLike = Pick<Currency, 'symbol' | 'numberFormat'> & { code?: string };

/**
 * Groups the integer digits the way the pattern says to.
 *
 * Patterns are read right to left. The rightmost run of `#` is the primary
 * group, the one before it is the repeating group, and a leading lone `#` is
 * just a placeholder for "everything else" rather than a group of one — which
 * is what made an earlier version emit "1,2,3,4,567" for `#,###`.
 *
 *   #,###.##     -> primary 3, repeating 3   -> 1,234,567
 *   #,##,###.##  -> primary 3, repeating 2   -> 12,34,567
 *   ####.##      -> no separators at all     -> 1234567
 */
function group(digits: string, wholePattern: string, separator: string) {
    const runs = wholePattern.split(/[.,]/).map((part) => part.length);
    if (runs.length < 2) return digits;

    const primary = runs[runs.length - 1];
    // A leading "#" is a placeholder, not a group, so fall back to primary.
    const previous = runs[runs.length - 2];
    const repeating = previous > 1 ? previous : primary;

    const out: string[] = [];
    let rest = digits;
    let size = primary;
    while (rest.length > size) {
        out.unshift(rest.slice(-size));
        rest = rest.slice(0, -size);
        size = repeating;
    }
    out.unshift(rest);
    return out.join(separator);
}

/**
 * The separators and precision a pattern implies.
 *
 * Exported because the numeric input has to read a typed string back into a
 * number using the same rules this formatter wrote it with — deriving them
 * twice is how a European currency ends up parsing "1.234,56" as 1.234.
 */
export function patternParts(numberFormat?: string | null) {
    const pattern = numberFormat || DEFAULT_CURRENCY.numberFormat;
    // "#.###,##" is the European convention: dot groups, comma decimates.
    const european = pattern.lastIndexOf(',') > pattern.lastIndexOf('.');
    const decimalSep = european ? ',' : '.';
    const cut = pattern.lastIndexOf(decimalSep);
    return {
        pattern,
        groupSep: european ? '.' : ',',
        decimalSep,
        wholePattern: cut === -1 ? pattern : pattern.slice(0, cut),
        decimals: cut === -1 ? 0 : pattern.length - cut - 1,
    };
}

export function formatCurrencyAmount(amount: number, currency?: CurrencyLike | null) {
    const c = currency ?? DEFAULT_CURRENCY;
    const { groupSep, decimalSep, wholePattern, decimals } = patternParts(c.numberFormat);

    const fixed = Math.abs(amount).toFixed(decimals);
    const [whole, fraction] = fixed.split('.');

    const body = group(whole, wholePattern, groupSep) + (fraction ? decimalSep + fraction : '');
    return `${amount < 0 ? '-' : ''}${c.symbol}${body}`;
}
