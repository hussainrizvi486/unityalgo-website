/**
 * Formatters shared by the admin list views.
 *
 * Dates are formatted on the server and passed down as strings: running Intl
 * in the browser instead would format against the viewer's locale and produce
 * a hydration mismatch against the server-rendered markup.
 */

const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const DATE_TIME = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (value: Date | string | null | undefined) =>
    value == null ? '—' : DATE.format(new Date(value));

export const formatDateTime = (value: Date | string | null | undefined) =>
    value == null ? '—' : DATE_TIME.format(new Date(value));

/** `null` amount means "custom quote" throughout the platform. */
export const formatPrice = (amount: number | null | undefined, currency = 'USD') =>
    amount == null
        ? 'Custom'
        : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

/** SCREAMING_SNAKE enum value → "Screaming snake". */
export const humanizeEnum = (value: string) =>
    value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
