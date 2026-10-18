import type { Currency } from '@/db/types';

export const NUMBER_FORMATS = ['#,###.##', '#,##,###.##', '####.##', '#.###,##'] as const;

/** Fallback when a plan has no currency, matching what Paddle charges in. */
export const DEFAULT_CURRENCY = { code: 'USD', symbol: '$', numberFormat: '#,###.##' };

type CurrencyLike = Pick<Currency, 'symbol' | 'numberFormat'> & { code?: string };

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
