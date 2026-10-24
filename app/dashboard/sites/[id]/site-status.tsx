'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { retrySiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SiteOverview, type KnownApps, type ModuleEntry, type PlanChoice } from './site-overview';
import type { InstallableApp } from '@/components/customer/install-app-dialog';
import { DeleteSite } from './delete-site';
import { DeployProgress } from '@/components/customer/deploy-progress';
import { LiveBadge } from '@/components/customer/live-badge';
import { useLiveSite } from '@/lib/use-live-site';
const installed = ['ready', 'stopping', 'stopped', 'restarting', 'restoring', 'updating', 'deactivated'];
function RetryButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Requesting retry…' : 'Retry installation'}
        </Button>
    );
}
export function SiteStatus({
    initial,
    applicationNames,
    plans,
    installable,
    moduleApps,
    known,
}: {
    initial: CustomerSite;
    applicationNames: Record<string, string>;
    plans: PlanChoice[];
    installable: InstallableApp[];
    moduleApps: ModuleEntry[];
    known: KnownApps;
}) {
    const { site, connection } = useLiveSite(initial);
    const [retry, action] = useActionState(retrySiteAction, undefined);
    const watchedCreation = useRef(!installed.includes(initial.status));
    const [celebrating, setCelebrating] = useState(false);
    useEffect(() => {
        if (site.status !== 'ready' || !watchedCreation.current) return;
        const start = setTimeout(() => setCelebrating(true), 0);
        const end = setTimeout(() => { watchedCreation.current = false; setCelebrating(false); }, 3500);
        return () => { clearTimeout(start); clearTimeout(end); };
    }, [site.status]);

    if (site.status === 'deleting')
        return (
            <div className="mx-auto portal-detail">
                <Link href="/dashboard/sites" className="portal-text-body text-muted-foreground hover:underline">Back to sites</Link>
                <h1 className="portal-page-title mt-6">{site.name}</h1>
                <Notice tone="info" className="mt-6">
                    <span className="inline-flex items-center gap-2">
                        <LoaderCircle className="size-4 motion-safe:animate-spin" />
                        {site.message}
                    </span>
                </Notice>
            </div>
        );
    if (installed.includes(site.status) && !celebrating)
        return (
            <SiteOverview
                site={site}
                applicationNames={applicationNames}
                plans={plans}
                installable={installable}
                moduleApps={moduleApps}
                known={known}
                onChange={() => {}}
            />
        );
    const phase =
        site.status === 'ready'
            ? 'success'
            : site.status === 'failed' || site.status === 'cleanup_required'
              ? 'failed'
              : 'creating';
    return (
        <div className="mx-auto portal-detail">
            <Link
                href="/dashboard/sites"
                className="portal-text-body text-muted-foreground hover:underline"
            >
                Back to sites
            </Link>
            <div className="mt-6 flex flex-wrap items-start justify-between gap-gap-lg">
                <div>
                    <h1 className="portal-page-title">
                        {site.name}
                    </h1>
                    <p className="mt-3 break-all portal-text-body text-foreground/70">
                        {site.domain}
                    </p>
                </div>
                {site.status === 'ready' && (
                    <Button asChild>
                        <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open site <ArrowUpRight className="size-4" />
                        </a>
                    </Button>
                )}
            </div>
            {phase === 'failed' && (
                <Notice tone="error" className="mt-4">
                    {site.error || site.message}
                </Notice>
            )}
            {site.trial && !site.trial.expired && (
                <Notice tone="info" className="mt-6">
                    <span className="font-medium">Free trial: {site.trial.days_left} day{site.trial.days_left === 1 ? '' : 's'} left.</span>{' '}
                    Subscribe to {site.plan_name ?? 'this plan'} before it ends to keep your site.
                </Notice>
            )}
            <DeployProgress site={site} />
            <LiveBadge connection={connection} className="mt-4" />
            <section className="mt-6 rounded-xl border border-border p-card">
                <h2 className="">Selected applications</h2>
                <p className="mt-3 portal-text-body text-foreground/70">
                    {site.apps
                        .map((app) => applicationNames[app] || app)
                        .join(', ')}
                </p>
                <p className="mt-3 portal-text-caption text-muted-foreground">
                    {site.plan_name ? `Plan: ${site.plan_name}. ` : ''}
                    Sign in with {site.owner_email || 'the email'} and the
                    password you chose during site creation.
                </p>
            </section>
            {site.status === 'failed' && (
                <form action={action} className="mt-6">
                    <input type="hidden" name="siteId" value={site.id} />
                    {retry?.error && (
                        <Notice tone="error" className="mb-4">
                            {retry.error}
                        </Notice>
                    )}
                    {retry?.success && (
                        <Notice tone="success" className="mb-4">
                            {retry.success}
                        </Notice>
                    )}
                    <RetryButton />
                </form>
            )}
            {site.status === 'failed' && (
                <div className="mt-6">
                    <DeleteSite site={site} onDone={() => {}} />
                </div>
            )}
            {site.status === 'cleanup_required' && (
                <Notice tone="warning" className="mt-6">
                    Server resources need an administrator check before this
                    site can be retried.{' '}
                    <Link href="/dashboard/support/new" className="underline">
                        Contact support
                    </Link>
                    .
                </Notice>
            )}
        </div>
    );
}
