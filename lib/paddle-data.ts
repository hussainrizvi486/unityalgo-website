/** Reading the loosely-typed JSON Paddle sends. */

export function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

export function asDate(value: unknown): Date | null {
    const text = asString(value);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Paddle sends money as a string of minor units ("2900" is 29.00). */
export function fromMinorUnits(value: unknown): number | null {
    if (value == null || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount / 100 : null;
}
