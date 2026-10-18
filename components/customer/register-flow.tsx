'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRight, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { cn } from '@/utils';
import { FormField, fieldAria } from '@/components/ui/form-field';
import {
    isValidEmail,
    validateField,
    PASSWORD_MIN_LENGTH,
    type FieldErrors,
    type RegistrationField,
} from '@/lib/registration-validation';
import { StepIndicator } from '@/components/customer/step-indicator';
import { AuthFrame } from '@/components/customer/auth-form';
import {
    requestEmailVerificationAction,
    resendVerificationCodeAction,
    verifyEmailOtpAction,
    createCustomerAction,
    restartRegistrationAction,
    type RegisterFormState,
} from '@/app/customer/actions';

const STEPS = ['Email', 'Verify', 'Your details'];

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

export function EmailStep() {
    const [state, formAction] = useActionState(requestEmailVerificationAction, undefined);
    const [local, setLocal] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);

    const [seen, setSeen] = useState(state);
    if (state !== seen) { setSeen(state); setLocal(null); setTouched(false); }

    const check = (value: string) =>
        !value.trim() ? 'Email address is required.'
            : !isValidEmail(value) ? 'Enter a valid email address.'
                : null;
    const error = (touched ? local : undefined) ?? state?.fieldErrors?.email ?? null;

    return (
        <AuthFrame eyebrow="Create your account" title="Start with your email" description="We'll send a verification code to confirm it's really you before setting up your account.">
            <StepIndicator labels={STEPS} step={1} />
            <form action={formAction} noValidate className="space-y-gap">
                <FormField id="email" label="Email address" error={error}>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            defaultValue={state?.values?.email ?? ''}
                            onBlur={(event) => { setTouched(true); setLocal(check(event.target.value)); }}
                            onChange={(event) => { if (touched) setLocal(check(event.target.value)); }}
                            {...fieldAria('email', error)}
                            className={'pl-9'}
                            placeholder="johndoe@mail.com"
                        />
                    </div>
                </FormField>
                <ErrorMessage state={state} />
                <SubmitButton label="Send verification code" pendingLabel="Sending…" />
            </form>
            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />Your details are encrypted and never shared</div>
        </AuthFrame>
    );
}

const RESEND_COOLDOWN_SECONDS = 60;

export function OtpStep({ email }: { email: string }) {
    const [state, formAction] = useActionState(verifyEmailOtpAction, undefined);
    const [resendState, resendAction] = useActionState(resendVerificationCodeAction, undefined);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
    const [resendNotice, setResendNotice] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const [seenResend, setSeenResend] = useState(resendState);
    if (resendState !== seenResend) {
        setSeenResend(resendState);
        if (resendState && !resendState.error) {
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setResendNotice(true);
        }
    }

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
                <SubmitButton label="Verify email" pendingLabel="Verifying…" />
            </form>
            <div className="mt-6 flex items-center justify-between text-sm">
                <form action={resendAction}>
                    <button
                        type="submit"
                        // disabled={cooldown > 0}
                        className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Resend code
                        {}
                    </button>
                </form>
                <form action={restartRegistrationAction}>
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

export function CustomerInfoStep({ email }: { email: string }) {
    const [state, formAction] = useActionState(createCustomerAction, undefined);

    const [local, setLocal] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const [seen, setSeen] = useState(state);
    if (state !== seen) {
        setSeen(state);
        setLocal({});
        setTouched({});
    }

    const errorFor = (field: RegistrationField) =>
        (touched[field] ? local[field] : undefined) ?? state?.fieldErrors?.[field] ?? null;

    const check = (field: RegistrationField) => (event: React.FocusEvent<HTMLInputElement>) => {
        setTouched((t) => ({ ...t, [field]: true }));
        setLocal((e) => ({ ...e, [field]: validateField(field, event.target.value) ?? undefined }));
    };

    const recheck = (field: RegistrationField) => (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!touched[field]) return;
        setLocal((e) => ({ ...e, [field]: validateField(field, event.target.value) ?? undefined }));
    };

    const fieldProps = (field: RegistrationField) => ({
        name: field,
        id: field,
        defaultValue: state?.values?.[field] ?? '',
        onBlur: check(field),
        onChange: recheck(field),
        ...fieldAria(field, errorFor(field)),
    });

    return (
        <AuthFrame eyebrow="Almost there" title="Tell us about yourself" description="Your email is verified — finish setting up your account.">
            <StepIndicator labels={STEPS} step={3} />
            {}
            <form action={formAction} noValidate className="space-y-gap">
                <div className="grid gap-gap sm:grid-cols-2">
                    <FormField id="firstName" label="First name" error={errorFor('firstName')}>
                        <Input {...fieldProps('firstName')} autoComplete="given-name" placeholder="John" />
                    </FormField>
                    <FormField id="lastName" label="Last name" error={errorFor('lastName')}>
                        <Input {...fieldProps('lastName')} autoComplete="family-name" placeholder="Doe" />
                    </FormField>
                </div>
                <FormField id="phone" label="Phone number" error={errorFor('phone')}>
                    <Input {...fieldProps('phone')} type="tel" autoComplete="tel" placeholder="+92 300 0000000" />
                </FormField>
                <FormField id="email" label="Email address" help="Verified in the previous step.">
                    <Input id="email" value={email} readOnly disabled className={cn('bg-muted text-muted-foreground')} />
                </FormField>
                <FormField
                    id="password"
                    label="Password"
                    error={errorFor('password')}
                    help={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
                >
                    <PasswordInput
                        {...fieldProps('password')}
                        defaultValue=""
                        autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                    />
                </FormField>
                <ErrorMessage state={state} />
                <SubmitButton label="Create account" pendingLabel="Creating account…" />
            </form>
        </AuthFrame>
    );
}
