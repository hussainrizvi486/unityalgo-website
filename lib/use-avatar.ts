'use client';

import { useSyncExternalStore } from 'react';
import { readAvatarUrl } from '@/lib/customer-mock';

const AVATAR_EVENT = 'unityalgo-customer-avatar';

function subscribe(onStoreChange: () => void) {
    window.addEventListener(AVATAR_EVENT, onStoreChange);
    window.addEventListener('storage', onStoreChange);
    return () => {
        window.removeEventListener(AVATAR_EVENT, onStoreChange);
        window.removeEventListener('storage', onStoreChange);
    };
}

export function useAvatarUrl(): string | null {
    return useSyncExternalStore(subscribe, readAvatarUrl, () => null);
}
