'use client';

import { useSyncExternalStore } from 'react';

/**
 * Media-query hooks.
 *
 * `matchMedia` is an external store, so it is read through
 * useSyncExternalStore rather than mirrored into state from an effect: that
 * avoids the extra render pass on mount and the tearing that comes with it.
 * The server snapshot is `false` so markup renders identically on both sides.
 */

const subscribers = new Map<string, (onChange: () => void) => () => void>();

function subscriberFor(query: string) {
    let subscribe = subscribers.get(query);
    if (!subscribe) {
        // Cached per query: useSyncExternalStore resubscribes whenever the
        // subscribe function's identity changes, so a fresh closure each render
        // would tear the listener down and rebuild it on every render.
        subscribe = (onChange: () => void) => {
            const mq = window.matchMedia(query);
            mq.addEventListener('change', onChange);
            return () => mq.removeEventListener('change', onChange);
        };
        subscribers.set(query, subscribe);
    }
    return subscribe;
}

export function useMediaQuery(query: string) {
    return useSyncExternalStore(
        subscriberFor(query),
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export function usePrefersReducedMotion() {
    return useMediaQuery('(prefers-reduced-motion: reduce)');
}
