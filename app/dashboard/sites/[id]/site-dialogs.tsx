'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRightLeft, KeyRound, LoaderCircle } from 'lucide-react';
import type { CustomerSite } from '@/lib/controller-client';
import { PlanCheckoutButton } from '@/components/customer/plan-checkout-button';
import { resetSitePasswordAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/utils';

export interface PlanChoice {
    id: string;
    name: string;
    price: string;
    users: number | null;
    vcpu: number | null;
    ramMb: number | null;
    storageGb: number | null;
}

function Go({ label, icon, enabled }: { label: string; icon: React.ReactNode; enabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={!enabled || pending}>
            {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : icon}
            {label}
        </Button>
    );
}

/** Close the dialog and refresh the page's state once the action reports success. */
function useDone(state: { success?: string } | undefined, onDone: () => void) {
    const seen = useRef(state);
    useEffect(() => {
        if (state !== seen.current) {
            seen.current = state;
            if (state?.success) onDone();
        }
    }, [state, onDone]);
}

const specs = (plan: PlanChoice) =>
    [
        plan.users == null ? 'Unlimited users' : `${plan.users} users`,
        plan.vcpu != null && `${plan.vcpu} vCPU`,
        plan.ramMb != null && `${plan.ramMb / 1024} GB RAM`,
        plan.storageGb != null && `${plan.storageGb} GB storage`,
    ].filter(Boolean).join(' · ');

export function ChangePlan({ site, plans, onDone }: { site: CustomerSite; plans: PlanChoice[]; onDone: () => void }) {
    const [open, setOpen] = useState(false);
    const [planId, setPlanId] = useState('');
    const others = plans.filter((plan) => plan.id !== site.plan_id);
    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="justify-start" disabled={site.status !== 'ready' || Boolean(site.activity)}>
                    <ArrowRightLeft className="size-4" />Change plan
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <div>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change plan</AlertDialogTitle>
                        <AlertDialogDescription>
                            Currently on <strong>{site.plan_name}</strong>. The site restarts for a minute or two while its new limits are applied.
                            A plan with fewer seats than your active users is refused.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-4 space-y-2">
                        {others.length === 0 && <p className="portal-text-body text-muted-foreground">No other plans are available.</p>}
                        {others.map((plan) => (
                            <button
                                key={plan.id} type="button" aria-pressed={planId === plan.id} onClick={() => setPlanId(plan.id)}
                                className={cn('w-full rounded-lg border p-3 text-left', planId === plan.id ? 'border-foreground bg-muted' : 'border-border')}
                            >
                                <span className="flex justify-between gap-3"><span className="font-semibold">{plan.name}</span><span className="portal-text-body text-foreground/70">{plan.price}</span></span>
                                <span className="mt-1 block portal-text-caption text-muted-foreground">{specs(plan)}</span>
                            </button>
                        ))}
                    </div>
                    <AlertDialogFooter className="mt-5">
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        {planId && <PlanCheckoutButton planId={planId} siteId={site.id} onSettled={() => { setOpen(false); onDone(); }} label="Review prorated payment" />}
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function ResetPassword({ site, onDone }: { site: CustomerSite; onDone: () => void }) {
    const [state, action] = useActionState(resetSitePasswordAction, undefined);
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    useDone(state, () => { onDone(); });
    const valid = password.length >= 12 && password === confirm;
    return (
        <AlertDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setPassword(''); setConfirm(''); } }}>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="justify-start" disabled={site.status !== 'ready' || Boolean(site.activity)}>
                    <KeyRound className="size-4" />Reset site password
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <form action={action}>
                    <input type="hidden" name="siteId" value={site.id} />
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset the site password</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sets a new password for <strong>{site.owner_email}</strong> on your ERP site and signs everyone out.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {state?.success ? (
                        <>
                            <Notice tone="success" className="mt-4">{state.success}</Notice>
                            <AlertDialogFooter className="mt-5"><AlertDialogCancel type="button">Close</AlertDialogCancel></AlertDialogFooter>
                        </>
                    ) : (
                        <>
                            <div className="mt-4 space-y-gap">
                                <FormField id="newPassword" label="New password" help="At least 12 characters.">
                                    <PasswordInput id="newPassword" name="newPassword" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={128} />
                                </FormField>
                                <FormField id="confirmPassword" label="Confirm password" error={confirm && confirm !== password ? 'Passwords do not match.' : null}>
                                    <PasswordInput id="confirmPassword" name="confirmPassword" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={128} />
                                </FormField>
                            </div>
                                    <AlertDialogFooter className="mt-5">
                                <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                                <Go label="Reset password" icon={<KeyRound className="size-4" />} enabled={valid} />
                            </AlertDialogFooter>
                        </>
                    )}
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
