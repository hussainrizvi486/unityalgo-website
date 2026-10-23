'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, LoaderCircle, Plus, RotateCcw, XCircle } from 'lucide-react';
import { cancelSubscriptionAction, resumeSubscriptionAction } from '@/app/customer/actions';
import { BillingPortalButton } from '@/components/customer/billing-portal-button';
import { PlanCheckoutButton } from '@/components/customer/plan-checkout-button';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/utils';

export interface UpgradeChoice { id: string; name: string; price: string; specs: string }

export interface SubscriptionActionsProps {
    subscriptionId: string;
    siteId: string | null;
    siteName: string | null;
    planId: string;
    planName: string;
    /** Formatted end of the paid period, e.g. "November 10, 2026". */
    endsOn: string | null;
    canUpgrade: boolean;
    canCancel: boolean;
    canResume: boolean;
    canUpdatePayment: boolean;
    canCreateSite: boolean;
    /** A past-due subscription has no paid period left, so canceling it ends it immediately. */
    endsImmediately?: boolean;
    upgrades: UpgradeChoice[];
}

/** The upgrade flow. `initialPlanId` opens it with that plan already chosen (for example the plan an app needs). */
export function UpgradeDialog({ props, initialPlanId = '', label = 'Upgrade plan', variant = 'default' }: { props: SubscriptionActionsProps; initialPlanId?: string; label?: string; variant?: 'default' | 'outline' }) {
    const [open, setOpen] = useState(false);
    const [planId, setPlanId] = useState(initialPlanId);
    const router = useRouter();
    return (
        <AlertDialog open={open} onOpenChange={(value) => { setOpen(value); setPlanId(value ? initialPlanId : ''); }}>
            <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant={variant}><ArrowUpRight className="size-4" />{label}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Upgrade {props.planName}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Choose a higher plan. You pay only the difference for the rest of this billing period, and you see the exact amount before anything is charged.
                        {props.siteName ? ` ${props.siteName} restarts for a minute or two while its new limits are applied.` : ''}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="mt-4 space-y-2">
                    {props.upgrades.length === 0 && <p className="portal-text-body text-muted-foreground">You are already on the highest plan.</p>}
                    {props.upgrades.map((plan) => (
                        <button key={plan.id} type="button" aria-pressed={planId === plan.id} onClick={() => setPlanId(plan.id)}
                            className={cn('w-full rounded-lg border p-3 text-left transition-colors', planId === plan.id ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50')}>
                            <span className="flex justify-between gap-3"><span className="font-semibold">{plan.name}</span><span className="portal-text-body text-foreground/70">{plan.price}</span></span>
                            {plan.specs ? <span className="mt-1 block portal-text-caption text-muted-foreground">{plan.specs}</span> : null}
                        </button>
                    ))}
                </div>
                <AlertDialogFooter className="mt-5">
                    <AlertDialogCancel type="button">Close</AlertDialogCancel>
                    {planId && <PlanCheckoutButton planId={planId} siteId={props.siteId ?? undefined} subscriptionId={props.subscriptionId} label="Review prorated payment"
                        onSettled={() => { setOpen(false); router.refresh(); }} />}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function Cancel({ props }: { props: SubscriptionActionsProps }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    async function confirm() {
        setBusy(true); setError('');
        const result = await cancelSubscriptionAction(props.subscriptionId).catch(() => ({ ok: false, error: 'Something went wrong. Please try again.' }));
        setBusy(false);
        if (!result.ok) return setError(result.error ?? 'The subscription could not be canceled.');
        setOpen(false);
        router.refresh();
    }
    return (
        <AlertDialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setError(''); } }}>
            <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="outline"><XCircle className="size-4" />Cancel subscription</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your {props.planName} subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {props.endsImmediately ? 'Because your last payment failed, canceling ends the subscription right away. ' : props.endsOn ? `You keep full access until ${props.endsOn}, and you will not be charged again. ` : 'You will not be charged again. '}
                        {props.siteName ? `${props.endsImmediately ? 'Then' : 'After that'}, ${props.siteName} is switched off. Your data is kept, and subscribing again switches it back on.` : 'You can subscribe again at any time.'}
                        {props.endsImmediately ? '' : ' You can change your mind until then.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
                <AlertDialogFooter className="mt-5">
                    <AlertDialogCancel type="button" disabled={busy}>Keep subscription</AlertDialogCancel>
                    <Button type="button" variant="destructive" disabled={busy} onClick={confirm}>
                        {busy ? <><LoaderCircle className="size-4 animate-spin" />Canceling…</> : props.endsImmediately ? 'Yes, cancel now' : 'Yes, cancel at period end'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function Resume({ props }: { props: SubscriptionActionsProps }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    return (
        <div>
            <Button type="button" size="sm" disabled={busy} onClick={async () => {
                setBusy(true); setError('');
                const result = await resumeSubscriptionAction(props.subscriptionId).catch(() => ({ ok: false, error: 'Something went wrong. Please try again.' }));
                setBusy(false);
                if (!result.ok) return setError(result.error ?? 'The cancellation could not be undone.');
                router.refresh();
            }}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Keep my subscription
            </Button>
            {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

export function SubscriptionActions(props: SubscriptionActionsProps) {
    return (
        <div className="flex flex-wrap items-start gap-2">
            {props.canCreateSite && <Button asChild size="sm"><Link href={`/dashboard/sites/new?plan=${props.planId}`}><Plus className="size-4" />Create a site with this plan</Link></Button>}
            {props.canUpgrade && <UpgradeDialog props={props} />}
            {props.canResume && <Resume props={props} />}
            {props.canUpdatePayment && <BillingPortalButton subscriptionId={props.subscriptionId} label="Update payment method" className="" />}
            {props.canCancel && <Cancel props={props} />}
        </div>
    );
}
