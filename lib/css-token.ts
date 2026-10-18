
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

export const rgbHex = ([r, g, b]: Rgb) =>
    '#' + [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
