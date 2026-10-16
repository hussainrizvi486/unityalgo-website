'use client';

import * as React from 'react';

/**
 * Live reference for the design tokens. Every value shown is read from the cascade at the point where the
 * swatch is drawn, so it reflects the active scope and any edit to app/globals.css with nothing copied here.
 */

const COLORS = [
    'background', 'foreground', 'card', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted',
    'muted-foreground', 'accent', 'border', 'input', 'ring', 'success', 'warning', 'destructive', 'destructive-foreground',
] as const;

const PARAMETERS = [
    'radius', 'page-pad', 'section-gap', 'card-pad', 'gap', 'header-h', 'max-w', 'text-scale', 'display-size',
    'heading-weight', 'border-width', 'btn-h', 'shadow',
] as const;

function Colors() {
    const ref = React.useRef<HTMLDivElement>(null);
    const [values, setValues] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
        if (!ref.current) return;
        const styles = getComputedStyle(ref.current);
        setValues(Object.fromEntries(COLORS.map((name) => [name, styles.getPropertyValue(`--${name}`).trim()])));
    }, []);
    return (
        <div ref={ref} className="grid grid-cols-2 gap-gap sm:grid-cols-4">
            {COLORS.map((name) => (
                <div key={name} className="overflow-hidden rounded-lg border">
                    <div className="h-16 border-b" style={{ backgroundColor: `var(--${name})` }} />
                    <div className="p-3">
                        <p className="text-xs font-medium text-foreground">--{name}</p>
                        <p className="text-xs text-muted-foreground">{values[name] ?? ''}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function Parameters() {
    const ref = React.useRef<HTMLDivElement>(null);
    const [values, setValues] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
        if (!ref.current) return;
        const styles = getComputedStyle(ref.current);
        setValues(Object.fromEntries(PARAMETERS.map((name) => [name, styles.getPropertyValue(`--${name}`).trim()])));
    }, []);
    return (
        <div ref={ref} className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
                <tbody>
                    {PARAMETERS.map((name) => (
                        <tr key={name} className="border-b last:border-b-0">
                            <td className="p-3 font-mono text-xs text-foreground">--{name}</td>
                            <td className="p-3 font-mono text-xs text-muted-foreground">{values[name] ?? ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function TokenReference() {
    return (
        <div className="space-y-gap-xl">
            <Colors />
            <Parameters />
        </div>
    );
}
