'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function RefreshSites({ pending }: { pending: boolean }) {
    const router = useRouter();
    const [refreshing, start] = useTransition();
    useEffect(() => {
        if (!pending) return;
        const timer = setInterval(() => {
            if (!document.hidden) router.refresh();
        }, 10_000);
        return () => clearInterval(timer);
    }, [pending, router]);
    return (
        <Button
            variant="outline"
            className="h-8"
            disabled={refreshing}
            onClick={() => start(() => router.refresh())}
        >
            <RefreshCw
                className={`size-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
            />
            Refresh
        </Button>
    );
}
