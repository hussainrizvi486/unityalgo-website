'use client';
import Link from 'next/link';
import { PortalPanel } from '@/components/customer/portal-panel';
import { useState } from 'react';
import { AppWindow, ArrowUpRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type App = {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    available: boolean;
};
export function AppStoreClient({ apps }: { apps: App[] }) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const categories = ['All', ...new Set(apps.map((app) => app.category))];
    const visible = apps.filter(
        (app) =>
            (category === 'All' || app.category === category) &&
            `${app.name} ${app.description}`
                .toLowerCase()
                .includes(search.toLowerCase()),
    );
    return (
        <div className="mx-auto portal-page">
            <p className="portal-text-caption font-semibold uppercase tracking-wider text-brand">
                Extend your workspace
            </p>
            <h1 className="portal-page-title mt-2">
                App Store
            </h1>
            <p className="mt-3 portal-form portal-text-body leading-7 text-ink-600">
                Explore applications for your business. Choose available
                applications when creating a Frappe site; packages requiring
                setup will become installable when your administrator configures
                them.
            </p>
            <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-500" />
                    <Input
                        aria-label="Search applications"
                        placeholder="Search applications…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-8"
                    />
                </div>
                <div
                    className="flex flex-wrap gap-2"
                    aria-label="Application categories"
                >
                    {categories.map((value) => (
                        <Button
                            key={value}
                            size="sm"
                            variant={category === value ? 'default' : 'outline'}
                            aria-pressed={category === value}
                            onClick={() => setCategory(value)}
                        >
                            {value}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="mt-8 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((app) => (
                    <PortalPanel key={app.id} className="flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                            <span className="flex size-12 items-center justify-center rounded-lg bg-accent">
                                <AppWindow className="size-6 text-brand" />
                            </span>
                            <Badge
                                variant={app.available ? 'success' : 'neutral'}
                            >
                                {app.available ? 'Available' : 'Requires setup'}
                            </Badge>
                        </div>
                        <p className="mt-6 portal-text-caption font-medium uppercase tracking-wider text-ink-500">
                            {app.category}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">
                            {app.name}
                        </h2>
                        <p className="mt-2 flex-1 portal-text-body leading-7 text-ink-600">
                            {app.description}
                        </p>
                        {app.available ? (
                            <Button asChild className="mt-4">
                                <Link
                                    href={`/dashboard/sites/new?app=${encodeURIComponent(app.id)}`}
                                >
                                    Create a site with this app{' '}
                                    <ArrowUpRight className="size-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Link
                                href="/dashboard/support/new"
                                className="mt-6 portal-text-body font-medium text-brand hover:underline"
                            >
                                Ask about installation
                            </Link>
                        )}
                    </PortalPanel>
                ))}
            </div>
            {!visible.length && (
                <p className="mt-12 rounded-xl border border-dashed border-ink-300 p-10 text-center portal-text-body text-ink-500">
                    No applications match your search.
                </p>
            )}
        </div>
    );
}
