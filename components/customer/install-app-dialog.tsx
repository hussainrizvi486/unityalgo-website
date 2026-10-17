'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { installAppAction } from '@/app/dashboard/app-store/actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/admin-format';
import { cn } from '@/utils';

export interface InstallSite {
    id: string;
    name: string;
    domain: string;
    /** Frappe app names already on the site. */
    apps: string[];
    /** Why the site cannot take an install now (stopped, busy…), or null. */
    unavailable: string | null;
    /** The site is on a free trial: paid apps wait until its plan is subscribed to. */
    trial?: boolean;
}

export interface InstallableApp {
    id: string;
    name: string;
    description?: string;
    frappeAppName: string;
    priceAmount: number | null;
    priceCurrency: string;
}

/**
 * Pick one of your sites and install an app on it. A paid app says what it costs and that it is added to the
 * subscription before anything is charged; a free one just installs.
 */
export function InstallAppDialog({
    app,
    sites,
    open,
    onOpenChange,
    fixedSiteId,
}: {
    app: InstallableApp;
    sites: InstallSite[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fixedSiteId?: string;
}) {
    const router = useRouter();
    const choices = fixedSiteId ? sites.filter((site) => site.id === fixedSiteId) : sites;
    const paid = (app.priceAmount ?? 0) > 0;
    const first = choices.find((site) => !site.unavailable && !site.apps.includes(app.frappeAppName) && !(paid && site.trial));
    const [siteId, setSiteId] = React.useState(first?.id ?? '');
    const [error, setError] = React.useState('');
    const [pending, startTransition] = React.useTransition();
    const price = paid ? formatPrice(app.priceAmount!, app.priceCurrency) : null;

    function submit() {
        setError('');
        startTransition(async () => {
            const result = await installAppAction({ appId: app.id, siteId });
            if (result.error) return setError(result.error);
            onOpenChange(false);
            router.push(`/dashboard/sites/${siteId}`);     // follow the install live on the site's own page
        });
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Install {app.name}</DialogTitle>
                    <DialogDescription>
                        {fixedSiteId ? 'It will be added to this site.' : 'Choose the site to install it on.'} The site is unavailable for a short time while it installs.
                    </DialogDescription>
                </DialogHeader>

                {choices.length === 0 ? (
                    <Notice tone="info">
                        You have no sites yet. <Link href="/dashboard/sites/new" className="font-medium underline">Create a site</Link> first.
                    </Notice>
                ) : (
                    <fieldset className="grid gap-2" disabled={pending}>
                        <legend className="sr-only">Site</legend>
                        {choices.map((site) => {
                            const installed = site.apps.includes(app.frappeAppName);
                            const trialBlocked = paid && Boolean(site.trial);
                            const blocked = Boolean(site.unavailable) || installed || trialBlocked;
                            return (
                                <label
                                    key={site.id}
                                    className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', siteId === site.id && !blocked && 'border-primary bg-accent', blocked && 'cursor-not-allowed opacity-60')}
                                >
                                    <input type="radio" name="site" className="mt-1" checked={siteId === site.id} disabled={blocked} onChange={() => setSiteId(site.id)} />
                                    <span className="min-w-0">
                                        <span className="block font-medium text-foreground">{site.name}</span>
                                        <span className="block truncate portal-text-caption text-muted-foreground">
                                            {installed ? 'Already installed' : trialBlocked ? 'Free trial: subscribe to the plan to add paid apps' : site.unavailable ?? site.domain}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </fieldset>
                )}

                {paid && (
                    <Notice tone="warning">
                        {app.name} costs <strong>{price}</strong> a month for each site it is installed on. It is added to your subscription and the
                        remaining part of this billing period is charged now. If the install fails you are not charged.
                    </Notice>
                )}
                {error && <Notice tone="error">{error}</Notice>}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button type="button" onClick={submit} disabled={pending || !siteId || choices.length === 0}>
                        {pending ? 'Installing…' : paid ? `Pay ${price}/mo and install` : 'Install'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
