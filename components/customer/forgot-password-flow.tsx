'use client';

import { Notice } from '@/components/ui/notice';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRight, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { StepIndicator } from '@/components/customer/step-indicator';
import { AuthFrame } from '@/components/customer/auth-form';
import {
    requestPasswordResetAction,
    resendPasswordResetCodeAction,
    verifyPasswordResetOtpAction,
    resetPasswordAction,
    restartPasswordResetAction,
    type RegisterFormState,
} from '@/app/customer/actions';

const STEPS = ['Email', 'Verify', 'New password'];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="h-9 w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            {pending ? pendingLabel : label}<ArrowRight className="h-4 w-4" />
        </Button>
    );
}

function ErrorMessage({ state }: { state: RegisterFormState | undefined }) {
    if (!state?.error) return null;
    return <Notice tone="error">{state.error}</Notice>;
}

export function ForgotPasswordEmailStep() {
    const [state, formAction] = useActionState(requestPasswordResetAction, undefined);

    return (
        <AuthFrame eyebrow="Reset password" title="Forgot your password?" description="Enter the email on your account and we'll send you a verification code to reset it.">
            <StepIndicator labels={STEPS} step={1} />
            <form action={formAction} className="space-y-gap">
                <div>
                    <Label htmlFor="email" className="mb-1.5 text-sm text-foreground/80">Email address</Label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="email" name="email" type="email" required autoComplete="email" className="pl-9" placeholder="you@company.com" />
                    </div>
                </div>
                <ErrorMessage state={state} />
                <SubmitButton label="Send verification code" pendingLabel="Sending…" />
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
                Remembered it? <Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
            </p>
            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Your details are encrypted and never shared</div>
        </AuthFrame>
    );
}

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordOtpStep({ email }: { email: string }) {
    const [state, formAction] = useActionState(verifyPasswordResetOtpAction, undefined);
    const [resendState, resendAction] = useActionState(resendPasswordResetCodeAction, undefined);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
    const [resendNotice, setResendNotice] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Adjusted during render when the action result changes, rather than
    // synced in an effect. React documents this pattern for "a value changed,
    // reset some state": it settles before the browser paints, where the
    // effect version committed once with the old state and again with the new.
    const [seenResend, setSeenResend] = useState(resendState);
    if (resendState !== seenResend) {
        setSeenResend(resendState);
        if (resendState && !resendState.error) {
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setResendNotice(true);
        }
    }

    // The notice clears itself. setState from a timer callback is not what the
    // cascading-render rule is about — only a synchronous call in the body is.
    useEffect(() => {
        if (!resendNotice) return;
        const timer = setTimeout(() => setResendNotice(false), 4000);
        return () => clearTimeout(timer);
    }, [resendNotice]);

    return (
        <AuthFrame eyebrow="Verify email" title="Check your inbox" description={`We sent a six-digit verification code to ${email}.`}>
            <StepIndicator labels={STEPS} step={2} />
            <form action={formAction} className="space-y-5">
                <div>
                    <Label htmlFor="otp" className="mb-2 text-sm text-foreground/80">Verification code</Label>
                    <InputOTP id="otp" name="otp" maxLength={6} required pattern={REGEXP_ONLY_DIGITS} containerClassName="justify-center">
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                </div>
                <ErrorMessage state={state} />
                <SubmitButton label="Verify code" pendingLabel="Verifying…" />
            </form>
            <div className="mt-6 flex items-center justify-between text-sm">
                <form action={resendAction}>
                    <button
                        type="submit"
                        disabled={cooldown > 0}
                        className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </button>
                </form>
                <form action={restartPasswordResetAction}>
                    <button type="submit" className="text-muted-foreground hover:text-foreground/80">Use a different email</button>
                </form>
            </div>
            {resendState?.error ? <p role="alert" className="mt-3 text-sm text-destructive">{resendState.error}</p> : null}
            {resendNotice ? (
                <Notice tone="success" className="mt-3">A new verification code has been sent to your email.</Notice>
            ) : null}
        </AuthFrame>
    );
}

export function ResetPasswordStep({ email }: { email: string }) {
    const [state, formAction] = useActionState(resetPasswordAction, undefined);

    return (
        <AuthFrame eyebrow="Almost done" title="Set a new password" description="Your email is verified — choose a new password for your account.">
            <StepIndicator labels={STEPS} step={3} />
            <form action={formAction} className="space-y-gap">
                <div>
                    <Label htmlFor="email" className="mb-1.5 text-sm text-foreground/80">Email address</Label>
                    <Input id="email" value={email} readOnly disabled className="bg-muted text-muted-foreground" />
                </div>
                <div>
                    <Label htmlFor="password" className="mb-1.5 text-sm text-foreground/80">New password</Label>
                    <PasswordInput id="password" name="password" required autoComplete="new-password" placeholder="Minimum 8 characters" />
                </div>
                <div>
                    <Label htmlFor="confirmPassword" className="mb-1.5 text-sm text-foreground/80">Confirm new password</Label>
                    <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" placeholder="Re-enter your new password" />
                </div>
                <ErrorMessage state={state} />
                <SubmitButton label="Reset password" pendingLabel="Resetting…" />
            </form>
        </AuthFrame>
    );
}
