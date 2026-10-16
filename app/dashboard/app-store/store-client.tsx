'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterPills } from '@/components/admin/filter-pills';

type App = {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    publisher: string | null;
    available: boolean;
};

const ALL = 'All';

/** Two-letter mark for an app, taken from its name. */
const initials = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

export function AppStoreClient({ apps }: { apps: App[] }) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState(ALL);
    const categories = useMemo(() => [ALL, ...new Set(apps.map((app) => app.category))], [apps]);
    const visible = apps.filter(
        (app) =>
            (category === ALL || app.category === category) &&
            `${app.name} ${app.description} ${app.publisher ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
    );

    return (
        <div className="portal-page">
            <div className="flex flex-col justify-between gap-gap lg:flex-row lg:items-center">
                <FilterPills
                    label="Application categories"
                    value={category}
                    onChange={setCategory}
                    options={categories.map((value) => ({ value, label: value }))}
                />
                <div className="relative w-full lg:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search apps"
                        placeholder="Search apps…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="mt-gap grid gap-gap md:grid-cols-2 xl:grid-cols-3">
                {visible.map((app) => (
                    <article key={app.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
                        <div className="flex-1 p-card">
                            <div className="flex items-start justify-between gap-gap-sm">
                                <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                                    {initials(app.name)}
                                </span>
                                <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
                                    {app.category}
                                </span>
                            </div>
                            <h2 className="mt-4 text-base">{app.name}</h2>
                            <p className="text-sm text-muted-foreground">by {app.publisher || 'UnityAlgo'}</p>
                            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-gap border-t bg-muted/50 px-card py-3">
                            <span className="text-sm font-semibold text-foreground">
                                {app.available ? 'Included' : <span className="font-medium text-muted-foreground">Needs setup</span>}
                            </span>
                            {app.available ? (
                                <Button asChild size="sm">
                                    <Link href={`/dashboard/sites/new?app=${encodeURIComponent(app.id)}`}>Install</Link>
                                </Button>
                            ) : (
                                <Button asChild size="sm" variant="outline">
                                    <Link href="/dashboard/support/new">Request</Link>
                                </Button>
                            )}
                        </div>
                    </article>
                ))}
            </div>
            {!visible.length && (
                <p className="mt-12 rounded-xl border border-dashed border-input p-10 text-center text-sm text-muted-foreground">
                    No applications match your search.
                </p>
            )}
        </div>
    );
}
