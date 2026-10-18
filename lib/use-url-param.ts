'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

export function useUrlParam(
    key: string,
    fallback: string,
    options: { debounceMs?: number } = {},
): [string, (next: string) => void] {
    const searchParams = useSearchParams();

    const [value, setValue] = React.useState(() => searchParams.get(key) ?? fallback);

    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const write = React.useCallback(
        (next: string) => {
            const url = new URL(window.location.href);
            if (next === fallback || next === '') url.searchParams.delete(key);
            else url.searchParams.set(key, next);
            window.history.replaceState(window.history.state, '', url);
        },
        [key, fallback],
    );

    const update = React.useCallback(
        (next: string) => {
            setValue(next);
            if (timer.current) clearTimeout(timer.current);
            const delay = options.debounceMs ?? 0;
            if (delay > 0) timer.current = setTimeout(() => write(next), delay);
            else write(next);
        },
        [write, options.debounceMs],
    );

    return [value, update];
}

/** The typed variant, for a filter with a fixed set of values. */
export function useUrlEnum<T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
): [T, (next: T) => void] {
    const [raw, setRaw] = useUrlParam(key, fallback);
    const value = (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
    return [value, setRaw as (next: T) => void];
}
