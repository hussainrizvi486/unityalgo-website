'use client';
import { useEffect } from 'react';

/** Remembers `?plan=` for an hour so it survives the sign-in and registration steps and page refreshes. */
export function PlanIntent() {
    useEffect(() => {
        const plan = new URLSearchParams(window.location.search).get('plan');
        if (!plan || !/^[A-Za-z0-9_-]{1,64}$/.test(plan)) return;
        document.cookie = `ua_plan=${encodeURIComponent(plan)}; path=/; max-age=3600; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`;
    }, []);
    return null;
}
