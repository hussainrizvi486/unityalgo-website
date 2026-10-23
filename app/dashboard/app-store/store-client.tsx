'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterPills } from '@/components/admin/filter-pills';
import { InstallAppDialog, type InstallSite } from '@/components/customer/install-app-dialog';
import { formatPrice } from '@/lib/admin-format';

type App = {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    iconUrl: string | null;
    publisher: string | null;
    frappeAppName: string | null;
    priceAmount: number | null;
    priceCurrency: string;
    available: boolean;
    /** Sites whose plan is too low for this app, with the plan it needs. */
    lockedBy?: Record<string, { planId: string; planName: string }>;
};

const ALL = 'All';

/** Two-letter mark for an app, taken from its name. */
const initials = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

export function AppStoreClient({ apps, sites }: { apps: App[]; sites: InstallSite[] }) {
    const [installing, setInstalling] = useState<App | null>(null);
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

            <div className="mt-gap grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                {visible.map((app) => (
                    <article key={app.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
                        <div className="flex-1 p-card">

                            <div className="flex items-center justify-between gap-gap-sm">
                                <div className="flex items-center gap-2">
                                    <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                                        {app.iconUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={app.iconUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
                                        ) : (
                                            initials(app.name)
                                        )}
                                    </span>
                                    <div>
                                        <h2 className="text-base">{app.name}</h2>
                                    </div>
                                </div>
                                <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
                                    {app.category}
                                </span>

                            </div>

                            <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{app.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-gap border-t bg-muted/50 px-card py-3">
                            <span className="text-sm font-semibold text-foreground">
                                {!app.available ? (
                                    <span className="font-medium text-muted-foreground">Needs setup</span>
                                ) : (app.priceAmount ?? 0) > 0 ? (
                                    <>{formatPrice(app.priceAmount!, app.priceCurrency)}<span className="font-normal text-muted-foreground">/mo per site</span></>
                                ) : (
                                    'Free'
                                )}
                            </span>
                            {app.available && app.frappeAppName ? (
                                sites.length > 0 && sites.every((site) => site.apps.includes(app.frappeAppName!)) ? (
                                    <span className="text-sm font-medium text-success">Installed</span>
                                ) : (
                                    sites.length > 0 && sites.every((site) => app.lockedBy?.[site.id])
                                        ? <Button size="sm" variant="outline" onClick={() => setInstalling(app)}>Needs {Object.values(app.lockedBy ?? {})[0]?.planName ?? 'a higher plan'}</Button>
                                        : <Button size="sm" onClick={() => setInstalling(app)}>Install</Button>
                                )
                            ) : (
                                <Button asChild size="sm" variant="outline">
                                    <Link href="/dashboard/support/new">Request</Link>
                                </Button>
                            )}
                        </div>
                    </article>
                ))}
            </div>
            {installing?.frappeAppName && (
                <InstallAppDialog
                    key={installing.id}
                    open
                    onOpenChange={(open) => !open && setInstalling(null)}
                    sites={sites}
                    app={{ id: installing.id, name: installing.name, frappeAppName: installing.frappeAppName, priceAmount: installing.priceAmount, priceCurrency: installing.priceCurrency, lockedBy: installing.lockedBy }}
                />
            )}
            {!visible.length && (
                <p className="mt-12 rounded-xl border border-dashed border-input p-10 text-center text-sm text-muted-foreground">
                    No applications match your search.
                </p>
            )}
        </div>
    );
}
