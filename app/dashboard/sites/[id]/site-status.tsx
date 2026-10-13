'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowUpRight, Check, Globe, LoaderCircle } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { retrySiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
const steps = [
    ['queued', 'Queued'],
    ['assigned', 'Server assigned'],
    ['pulling', 'Downloading images'],
    ['configuring', 'Configuring services'],
    ['installing', 'Installing Frappe & apps'],
    ['starting', 'Checking application health'],
    ['routing', 'Connecting site address'],
    ['ready', 'Ready'],
];
const terminal = ['ready', 'failed', 'cleanup_required'];
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
}: {
    initial: CustomerSite;
    applicationNames: Record<string, string>;
}) {
    const [site, setSite] = useState(initial);
    const [seenInitial, setSeenInitial] = useState(initial);
    if (initial !== seenInitial) {
        setSeenInitial(initial);
        setSite(initial);
    }
    const [error, setError] = useState('');
    const [retry, action] = useActionState(retrySiteAction, undefined);
    const [attempt, setAttempt] = useState(0);
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
                if (!response.ok) throw new Error();
                const value: CustomerSite = await response.json();
                if (disposed) return;
                setSite(value);
                setError('');
                failures = 0;
                if (terminal.includes(value.status)) return;
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
        if (!terminal.includes(initial.status) || retry?.success || attempt > 0)
            void refresh();
        return () => {
            disposed = true;
            controller.abort();
            clearTimeout(timer);
        };
    }, [initial.id, initial.status, retry, attempt]);
    const index = steps.findIndex(([status]) => status === site.status);
    return (
        <div className="mx-auto max-w-4xl">
            <Link
                href="/dashboard/sites"
                className="text-sm text-ink-500 hover:underline"
            >
                Back to sites
            </Link>
            <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        {site.name}
                    </h1>
                    <p className="mt-3 break-all text-sm text-ink-600">
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
            <section className="mt-8 rounded-xl border border-ink-200 p-6">
                <div className="flex items-center gap-3">
                    <Globe className="size-5 text-brand" />
                    <h2 className="font-semibold">Installation progress</h2>
                    <span className="ml-auto text-sm text-ink-500">
                        {site.progress}%
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Site installation"
                    aria-valuenow={site.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-5 h-2 overflow-hidden rounded-full bg-ink-100"
                >
                    <div
                        className="h-full bg-ink-900 transition-[width] motion-reduce:transition-none"
                        style={{ width: `${site.progress}%` }}
                    />
                </div>
                <p className="mt-5 text-sm leading-7 text-ink-600">
                    {site.message}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                    Assigned server: {site.server_name}
                </p>
                <ol className="mt-8 grid gap-4 sm:grid-cols-2">
                    {steps.map(([status, label], step) => (
                        <li
                            key={status}
                            className={`flex items-center gap-3 text-sm ${step <= index ? 'text-ink-900' : 'text-ink-500'}`}
                        >
                            <span
                                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step < index || site.status === 'ready' ? 'bg-ink-900 text-white' : 'border border-ink-300'}`}
                            >
                                {step < index || site.status === 'ready' ? (
                                    <Check className="size-3.5" />
                                ) : step === index ? (
                                    <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
                                ) : (
                                    step + 1
                                )}
                            </span>
                            {label}
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
            <section className="mt-6 rounded-xl border border-ink-200 p-6">
                <h2 className="font-semibold">Selected applications</h2>
                <p className="mt-3 text-sm text-ink-600">
                    {site.apps
                        .map((app) => applicationNames[app] || app)
                        .join(', ')}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                    Your Frappe account uses Administrator and the password you
                    chose during site creation.
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
