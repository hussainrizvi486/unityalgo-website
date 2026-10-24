'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { installAppAction, previewInstallAction, type InstallPreview } from '@/app/dashboard/app-store/actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/admin-format';
import { cn } from '@/utils';

export interface InstallSite {
    id: string;
    name: string;
    domain: string;
    /** Frappe app names and `module:<id>` keys already on the site. */
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
    /** How the site records it: the Frappe app name, or `module:<id>` for a module entry. */
    installKey: string;
    priceAmount: number | null;
    priceCurrency: string;
    /** Sites whose plan is too low for this app, with the plan that would make it work. */
    lockedBy?: Record<string, { planId: string; planName: string }>;
}

const money = (amount: number, currency: string) => new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);

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
    const first = choices.find((site) => !site.unavailable && !site.apps.includes(app.installKey) && !(paid && site.trial) && !app.lockedBy?.[site.id]);
    const [siteId, setSiteId] = React.useState(first?.id ?? '');
    const [error, setError] = React.useState('');
    const [warning, setWarning] = React.useState('');
    const [pending, startTransition] = React.useTransition();
    const price = paid ? formatPrice(app.priceAmount!, app.priceCurrency) : null;
    const selectedLocked = Boolean(siteId && app.lockedBy?.[siteId]);

    // A paid install shows the exact prorated amount Paddle will charge, before the customer agrees to it.
    const needsPreview = paid && Boolean(siteId) && !selectedLocked;
    const previewKey = `${app.id}:${siteId}`;
    const [loaded, setLoaded] = React.useState<{ key: string; value: InstallPreview } | null>(null);
    const preview = needsPreview && loaded?.key === previewKey ? loaded.value : null;
    const previewing = needsPreview && !preview;
    React.useEffect(() => {
        if (!needsPreview) return;
        let current = true;
        previewInstallAction({ appId: app.id, siteId })
            .then((value) => { if (current) setLoaded({ key: previewKey, value }); })
            .catch(() => { if (current) setLoaded({ key: previewKey, value: { error: 'The price could not be calculated. Please try again.' } }); });
        return () => { current = false; };
    }, [needsPreview, previewKey, app.id, siteId]);

    function submit() {
        setError('');
        startTransition(async () => {
            const result = await installAppAction({ appId: app.id, siteId });
            if (result.error) return setError(result.error);
            if (result.warning) { setWarning(result.warning); router.refresh(); return; }
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
                            const installed = site.apps.includes(app.installKey);
                            const trialBlocked = paid && Boolean(site.trial);
                            const needs = app.lockedBy?.[site.id];
                            const blocked = Boolean(site.unavailable) || installed || trialBlocked || Boolean(needs);
                            return (
                                <label
                                    key={site.id}
                                    className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', siteId === site.id && !blocked && 'border-primary bg-accent', blocked && 'cursor-not-allowed opacity-60')}
                                >
                                    <input type="radio" name="site" className="mt-1" checked={siteId === site.id} disabled={blocked} onChange={() => setSiteId(site.id)} />
                                    <span className="min-w-0">
                                        <span className="block font-medium text-foreground">{site.name}</span>
                                        <span className="block truncate portal-text-caption text-muted-foreground">
                                            {installed ? 'Already installed' : needs ? <>Needs the {needs.planName} plan or higher. <Link href="/dashboard/subscription" className="font-medium underline">Upgrade</Link></> : trialBlocked ? 'Free trial: subscribe to the plan to add paid apps' : site.unavailable ?? site.domain}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </fieldset>
                )}

                {paid && !selectedLocked && (
                    <Notice tone="warning">
                        {previewing || (!preview && siteId) ? 'Calculating the price for this site…' : preview?.ok && preview.chargeNow != null && preview.currency ? (
                            <>
                                {app.name} costs <strong>{price}</strong> a month for each site it is installed on. It is added to this site&apos;s subscription, so it renews with your plan.
                                You are charged <strong>{money(preview.chargeNow, preview.currency)}</strong> today for the rest of this billing period
                                {preview.nextTotal != null && preview.nextBilledAt ? <>, and your subscription is <strong>{money(preview.nextTotal, preview.currency)}</strong> a month from {new Date(preview.nextBilledAt).toLocaleDateString('en-US', { dateStyle: 'long' })}</> : null}.
                                If the install fails you are not charged.
                            </>
                        ) : preview?.error ? preview.error : (
                            <>{app.name} costs <strong>{price}</strong> a month for each site it is installed on. Choose a site to see today&apos;s charge.</>
                        )}
                    </Notice>
                )}
                {error && <Notice tone="error">{error}</Notice>}
                {warning && <Notice tone="warning">{warning}</Notice>}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{warning ? 'Close' : 'Cancel'}</Button>
                    <Button type="button" onClick={submit} disabled={pending || Boolean(warning) || !siteId || choices.length === 0 || selectedLocked || (paid && !preview?.ok)}>
                        {pending ? 'Installing…' : paid ? (preview?.ok && preview.chargeNow != null && preview.currency ? `Pay ${money(preview.chargeNow, preview.currency)} and install` : 'Pay and install') : 'Install'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
