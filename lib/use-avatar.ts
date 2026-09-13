'use client';

import { useSyncExternalStore } from 'react';
import { readAvatarUrl } from '@/lib/customer-mock';

const AVATAR_EVENT = 'unityalgo-customer-avatar';

function subscribe(onStoreChange: () => void) {
    // saveAvatarUrl() dispatches AVATAR_EVENT for same-tab updates; the
    // 'storage' event covers the case where the avatar is changed in another
    // tab, which localStorage does not otherwise notify this one about.
    window.addEventListener(AVATAR_EVENT, onStoreChange);
    window.addEventListener('storage', onStoreChange);
    return () => {
        window.removeEventListener(AVATAR_EVENT, onStoreChange);
        window.removeEventListener('storage', onStoreChange);
    };
}

/**
 * The customer's profile picture, as stored in this browser.
 *
 * Avatar upload has no storage backend yet, so the image lives in
 * localStorage (see lib/customer-mock.ts). Three separate components need to
 * show it, and each previously read it in its own `useEffect` — which meant
 * they only picked up the value once on mount, so uploading a new picture on
 * the profile page left the sidebar showing the old one until a reload.
 *
 * useSyncExternalStore is the right primitive here: localStorage is an
 * external store, every consumer stays subscribed, and there is no
 * setState-in-effect cascade. It returns null during SSR so the server and
 * the first client render agree.
 */
export function useAvatarUrl(): string | null {
    return useSyncExternalStore(subscribe, readAvatarUrl, () => null);
}
