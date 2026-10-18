'use client';

import { useSyncExternalStore } from 'react';

const subscribers = new Map<string, (onChange: () => void) => () => void>();

function subscriberFor(query: string) {
    let subscribe = subscribers.get(query);
    if (!subscribe) {
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
