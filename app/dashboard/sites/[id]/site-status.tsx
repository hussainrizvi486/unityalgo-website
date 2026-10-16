'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowUpRight, Check, CircleAlert, Globe, LoaderCircle, X } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { retrySiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SiteOverview, type PlanChoice } from './site-overview';
import { DeleteSite } from './delete-site';
const terminal = ['ready', 'stopped', 'deactivated', 'failed', 'cleanup_required'];
// Once installed, the site gets the full management page instead of the progress view.
const installed = ['ready', 'stopping', 'stopped', 'restarting', 'restoring', 'updating', 'deactivated'];
const settled = (value: CustomerSite) => terminal.includes(value.status) && !value.activity;
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
}: {
    initial: CustomerSite;
    applicationNames: Record<string, string>;
    plans: PlanChoice[];
}) {
    const [site, setSite] = useState(initial);
    const [seenInitial, setSeenInitial] = useState(initial);
    if (initial !== seenInitial) {
        setSeenInitial(initial);
        setSite(initial);
    }
    const [error, setError] = useState('');
    const router = useRouter();
    const [retry, action] = useActionState(retrySiteAction, undefined);
    const [attempt, setAttempt] = useState(0);
    const initialSettled = terminal.includes(initial.status) && !initial.activity;
    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        let failures = 0;
        async function refresh() {
            if (document.hidden) {
                timer = setTimeout(refresh, 5000);
                return;
            }
            try {
                const response = await fetch(
                    `/api/customer/sites/${initial.id}`,
                    { signal: controller.signal },
                );
                if (response.status === 404) {
                    // The site is gone (deleted): leave a page that no longer exists.
                    router.replace('/dashboard/sites');
                    return;
                }
                if (!response.ok) throw new Error();
                const value: CustomerSite = await response.json();
                if (disposed) return;
                setSite(value);
                setError('');
                failures = 0;
                if (settled(value)) return;
            } catch {
                if (disposed) return;
                failures++;
                setError(
                    'Could not refresh the site status. Retrying shortly.',
                );
            }
            timer = setTimeout(
                refresh,
                Math.min(30_000, 5000 * Math.max(failures, 1)),
            );
        }
        if (!initialSettled || retry?.success || attempt > 0)
            void refresh();
        return () => {
            disposed = true;
            controller.abort();
            clearTimeout(timer);
        };
    }, [initial.id, initialSettled, retry, attempt, router]);
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
    if (installed.includes(site.status))
        return (
            <SiteOverview
                site={site}
                applicationNames={applicationNames}
                plans={plans}
                onChange={() => setAttempt((value) => value + 1)}
            />
        );
    const phase =
        site.status === 'ready'
            ? 'success'
            : site.status === 'failed' || site.status === 'cleanup_required'
              ? 'failed'
              : 'creating';
    const phaseLabel = {
        creating: 'Creating Site',
        success: 'Success',
        failed: 'Failed',
    }[phase];
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
                            href={`https://${site.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open site <ArrowUpRight className="size-4" />
                        </a>
                    </Button>
                )}
            </div>
            <div
                role="status"
                className="mt-6 flex items-center gap-3 rounded-xl border border-border p-4"
            >
                {phase === 'creating' && (
                    <LoaderCircle className="size-5 motion-safe:animate-spin" />
                )}
                {phase === 'success' && <Check className="size-5 text-success" />}
                {phase === 'failed' && <CircleAlert className="size-5 text-destructive" />}
                <div>
                    <p className="font-semibold">{phaseLabel}</p>
                    <p className="portal-text-caption text-muted-foreground">
                        {phase === 'creating' &&
                            'The site is being provisioned and configured.'}
                        {phase === 'success' &&
                            'Deployment completed. Your site is ready to use.'}
                        {phase === 'failed' && 'Deployment encountered an error.'}
                    </p>
                </div>
            </div>
            {phase === 'failed' && (
                <Notice tone="error" className="mt-4">
                    {site.error || site.message}
                </Notice>
            )}
            <section className="mt-6 rounded-xl border border-border p-card">
                <div className="flex items-center gap-3">
                    <Globe className="size-5 text-primary" />
                    <h2 className="">Installation progress</h2>
                    <span className="ml-auto portal-text-body text-muted-foreground">
                        {site.progress}%
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Site installation"
                    aria-valuenow={site.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-5 h-2 overflow-hidden rounded-full bg-secondary"
                >
                    <div
                        className="h-full bg-primary transition-[width] motion-reduce:transition-none"
                        style={{ width: `${site.progress}%` }}
                    />
                </div>
                <p className="mt-5 portal-text-body leading-7 text-foreground/70">
                    {site.message}
                </p>
                <p className="mt-3 portal-text-caption text-muted-foreground">
                    Assigned server: {site.server_name}
                </p>
                <ol className="mt-8 grid gap-gap sm:grid-cols-2">
                    {site.steps.map((item, number) => (
                        <li
                            key={item.key}
                            className={`flex items-center gap-3 portal-text-body ${item.state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}
                        >
                            <span
                                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${item.state === 'done' ? 'bg-primary text-destructive-foreground' : item.state === 'failed' ? 'bg-destructive text-destructive-foreground' : 'border border-input'}`}
                            >
                                {item.state === 'done' ? (
                                    <Check className="size-3.5" />
                                ) : item.state === 'failed' ? (
                                    <X className="size-3.5" />
                                ) : item.state === 'active' ? (
                                    <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
                                ) : (
                                    number + 1
                                )}
                            </span>
                            {item.label}
                        </li>
                    ))}
                </ol>
                {error && (
                    <Notice tone="warning" className="mt-6">
                        {error}
                    </Notice>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-6"
                    onClick={() => setAttempt((value) => value + 1)}
                >
                    Refresh status
                </Button>
            </section>
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
                    <DeleteSite site={site} onDone={() => setAttempt((value) => value + 1)} />
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
