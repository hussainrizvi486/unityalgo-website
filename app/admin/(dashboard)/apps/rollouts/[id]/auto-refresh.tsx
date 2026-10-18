'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ active, seconds = 3 }: { active: boolean; seconds?: number }) {
    const router = useRouter();
    React.useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => router.refresh(), seconds * 1000);
        return () => clearInterval(timer);
    }, [active, seconds, router]);
    return null;
}
