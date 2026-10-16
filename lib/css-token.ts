/**
 * Read design tokens from CSS at runtime, for the places that cannot use a class: canvas drawing, WebGL
 * materials and charting libraries. The values come from the live cascade, so a scope (`.dashboard.dark`)
 * or an edited token is picked up with no second copy of any colour.
 */

export type Rgb = [number, number, number];

function probe(element: Element | null) {
    const host = (element ?? document.documentElement) as HTMLElement;
    const node = document.createElement('span');
    node.style.display = 'none';
    host.appendChild(node);
    return { host, node };
}

/** A token such as `--primary` as [r, g, b] in 0–255. */
export function tokenRgb(name: string, element: Element | null = null): Rgb {
    const { node } = probe(element);
    node.style.color = `var(${name})`;
    const value = getComputedStyle(node).color;
    node.remove();
    const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Blend `a` toward `b` by `amount` (0 = a, 1 = b). */
export function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
    return a.map((channel, index) => channel + (b[index] - channel) * amount) as Rgb;
}

export const rgbCss = ([r, g, b]: Rgb, alpha = 1) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alpha})`;
export const rgbUnit = ([r, g, b]: Rgb): Rgb => [r / 255, g / 255, b / 255];
export const rgbHex = ([r, g, b]: Rgb) =>
    '#' + [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');

/** Convenience: a token as a CSS colour string with optional alpha. */
export const tokenCss = (name: string, alpha = 1, element: Element | null = null) => rgbCss(tokenRgb(name, element), alpha);
