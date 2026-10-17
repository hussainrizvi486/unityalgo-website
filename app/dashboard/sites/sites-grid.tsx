'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Globe } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { Badge } from '@/components/ui/badge';
import { PortalPanel } from '@/components/customer/portal-panel';
import { LiveBadge } from '@/components/customer/live-badge';

/** The customer's sites. New sites, progress and status changes arrive on their own, with no refresh. */
export function SitesGrid({ initial }: { initial: CustomerSite[] }) {
    const [sites, setSites] = useState(initial);
    const [seenInitial, setSeenInitial] = useState(initial);
    const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
    if (initial !== seenInitial) {
        setSeenInitial(initial);
        setSites(initial);
    }

    useEffect(() => {
        if (typeof EventSource === 'undefined') return;
        const source = new EventSource('/api/customer/sites/stream');
        source.onopen = () => setConnection('live');
        source.onmessage = (event) => {
            try {
                setSites(JSON.parse(event.data));
                setConnection('live');
            } catch { /* ignore a malformed frame */ }
        };
        source.onerror = () => setConnection('reconnecting');
        return () => source.close();
    }, []);

    if (!sites.length)
        return (
            <div className="mt-10 rounded-xl border border-dashed border-input px-6 py-16 text-center">
                <Globe className="mx-auto size-10 text-muted-foreground" />
                <h2 className="mt-5 text-xl">Your first site starts here.</h2>
                <p className="mx-auto mt-3 max-w-md portal-text-body leading-7 text-foreground/70">
                    Choose a name and your applications. We will assign an available server and start the Frappe
                    installation.
                </p>
                <Link href="/dashboard/sites/new" className="mt-6 inline-block font-semibold text-primary underline">
                    Create your first site
                </Link>
            </div>
        );

    return (
        <>
            <LiveBadge connection={connection} className="mt-6" />
            <div className="mt-3 grid gap-gap-lg md:grid-cols-2 xl:grid-cols-3">
                {sites.map((site) => (
                    <PortalPanel key={site.id}>
                        <div className="flex items-center justify-between gap-3">
                            <Globe className="size-6 text-primary" />
                            <Badge variant={site.status === 'ready' ? 'success' : ['failed', 'cleanup_required'].includes(site.status) ? 'error' : 'neutral'}>
                                {site.status.replaceAll('_', ' ')}
                            </Badge>
                        </div>
                        <h2 className="mt-5 text-xl">{site.name}</h2>
                        <p className="mt-2 break-all portal-text-body text-muted-foreground">{site.domain}</p>
                        {site.trial && (
                            <p className={`mt-3 portal-text-caption font-medium ${site.trial.expired ? 'text-destructive' : 'text-primary'}`}>
                                {site.trial.expired ? 'Free trial ended: subscribe to use this site' : `Free trial: ${site.trial.days_left} day${site.trial.days_left === 1 ? '' : 's'} left`}
                            </p>
                        )}
                        <p className="mt-4 portal-text-caption text-muted-foreground">Server: {site.server_name}</p>
                        <p className="mt-3 min-h-12 portal-text-body leading-6 text-foreground/70">{site.message}</p>
                        {site.status !== 'ready' && site.progress > 0 && site.progress < 100 && (
                            <div role="progressbar" aria-label={`${site.name} installation`} aria-valuenow={site.progress} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${site.progress}%` }} />
                            </div>
                        )}
                        <Link href={`/dashboard/sites/${site.id}`} className="mt-5 inline-flex items-center gap-2 portal-text-body font-semibold text-primary">
                            View site <ArrowUpRight className="size-4" />
                        </Link>
                    </PortalPanel>
                ))}
            </div>
        </>
    );
}
