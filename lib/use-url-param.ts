'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * A piece of list state that lives in the URL query string.
 *
 * Filters, search text, sort and page used to be component state, so a refresh
 * or a back-navigation dropped them and the reader started over. Putting them
 * in the URL also makes a filtered list something you can bookmark or paste to
 * a colleague.
 *
 * The URL is written with `history.replaceState`, not `router.replace`. A
 * router navigation re-runs the server component and refetches the rows, which
 * for a client-side grid that already holds every row is a round trip that
 * changes nothing on screen — and on a search box it would fire per keystroke.
 * `replaceState` updates the address bar only.
 *
 * `replace` rather than `push` so the back button leaves the list rather than
 * stepping back through every filter the reader tried.
 */
export function useUrlParam(
    key: string,
    fallback: string,
    options: { debounceMs?: number } = {},
): [string, (next: string) => void] {
    const searchParams = useSearchParams();

    // Read once. After mount this hook owns the value; re-reading on every
    // render would fight the local state during the debounce window.
    const [value, setValue] = React.useState(() => searchParams.get(key) ?? fallback);

    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const write = React.useCallback(
        (next: string) => {
            const url = new URL(window.location.href);
            // A value equal to the default carries no information, so it is
            // left out and the URL stays short.
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
    // A hand-edited URL can carry anything; an unknown value falls back rather
    // than filtering the list down to nothing with no way to tell why.
    const value = (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
    return [value, setRaw as (next: T) => void];
}
