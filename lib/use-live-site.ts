'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerSite } from '@/lib/controller-client';

type Connection = 'connecting' | 'live' | 'reconnecting';

/**
 * Keeps a site's status current without the customer refreshing the page.
 *
 * It listens to the server's event stream, which pushes a new copy of the site the moment it changes, and falls
 * back to checking every few seconds where the browser cannot hold the stream open. `connection` says which of
 * those states the page is in, so it can show "Live" or "Reconnecting…".
 */
export function useLiveSite(initial: CustomerSite) {
    const router = useRouter();
    const [site, setSite] = useState(initial);
    const [connection, setConnection] = useState<Connection>('connecting');
    const [seenInitial, setSeenInitial] = useState(initial);
    if (initial !== seenInitial) {
        // The server rendered a newer copy (after an action): take it, the stream will catch up from there.
        setSeenInitial(initial);
        setSite(initial);
    }
    const leave = useRef(() => router.replace('/dashboard/sites'));

    useEffect(() => {
        let stopped = false;
        let source: EventSource | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = async () => {
            if (stopped) return;
            try {
                if (!document.hidden) {
                    const response = await fetch(`/api/customer/sites/${initial.id}`, { cache: 'no-store' });
                    if (response.status === 404) return leave.current();
                    if (response.ok) {
                        setSite(await response.json());
                        setConnection('live');
                    } else setConnection('reconnecting');
                }
            } catch {
                setConnection('reconnecting');
            }
            timer = setTimeout(poll, 4000);
        };

        if (typeof EventSource === 'undefined') {
            void poll();
        } else {
            source = new EventSource(`/api/customer/sites/${initial.id}/stream`);
            source.onopen = () => setConnection('live');
            source.onmessage = (event) => {
                try {
                    setSite(JSON.parse(event.data));
                    setConnection('live');
                } catch { /* ignore a malformed frame */ }
            };
            source.addEventListener('gone', () => leave.current());
            // EventSource reconnects on its own; this only tells the customer it is doing so.
            source.onerror = () => setConnection('reconnecting');
        }
        return () => {
            stopped = true;
            source?.close();
            clearTimeout(timer);
        };
    }, [initial.id]);

    return { site, connection };
}
