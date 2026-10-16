'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { createSiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { Notice } from '@/components/ui/notice';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { StepIndicator } from '@/components/customer/step-indicator';
import { FRAPPE_COUNTRIES } from '@/lib/frappe-countries';
import {
    COA_TYPES,
    WIZARD_STEPS,
    validateSiteWizard,
    type SiteWizardValues,
} from '@/lib/site-wizard';
import { cn } from '@/utils';

interface PlanOption {
    id: string;
    name: string;
    tagline: string | null;
    features: string[];
    price: string;
    userLimit: number | null;
    vcpu: number | null;
    ramMb: number | null;
    storageGb: number | null;
}

type Availability =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'available' }
    | { state: 'unavailable'; reason: string }
    | { state: 'error' };

function CreateButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? 'Starting deployment…' : 'Create site'}
        </Button>
    );
}

export function SiteForm({
    requestKey,
    apps,
    plans,
    currencies,
    available,
    domainSuffix,
    selectedApp,
}: {
    requestKey: string;
    apps: { id: string; name: string; available: boolean }[];
    plans: PlanOption[];
    currencies: { code: string; name: string }[];
    available: boolean;
    domainSuffix: string;
    selectedApp?: string;
}) {
    const [state, action] = useActionState(createSiteAction, undefined);
    const [step, setStep] = useState(0);
    const [values, setValues] = useState<SiteWizardValues>({
        slug: '',
        companyName: '',
        country: '',
        currency: '',
        coaType: 'standard',
        planId: '',
        apps: apps
            .filter((app) => app.available && app.id === selectedApp)
            .map((app) => app.id),
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<
        Partial<Record<keyof SiteWizardValues, string>>
    >({});
    const [availability, setAvailability] = useState<Availability>({
        state: 'idle',
    });
    const checkId = useRef(0);

    const set = <K extends keyof SiteWizardValues>(
        key: K,
        value: SiteWizardValues[K],
    ) => {
        setValues((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
    };

    // Debounced, race-safe availability check for the site name.
    useEffect(() => {
        const slug = values.slug;
        const syntax = validateSiteWizard({ ...values, slug }, 0).slug;
        const id = ++checkId.current;
        if (!slug || syntax) return;
        const timer = setTimeout(async () => {
            setAvailability({ state: 'checking' });
            try {
                const response = await fetch(
                    `/api/customer/sites/check-slug?slug=${encodeURIComponent(slug)}`,
                );
                if (!response.ok) throw new Error();
                const result = await response.json();
                if (id !== checkId.current) return;
                setAvailability(
                    result.available
                        ? { state: 'available' }
                        : {
                              state: 'unavailable',
                              reason:
                                  result.reason || 'This site name is taken.',
                          },
                );
            } catch {
                if (id === checkId.current) setAvailability({ state: 'error' });
            }
        }, 400);
        return () => clearTimeout(timer);
        // Only the slug drives the check.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values.slug]);

    const slugSyntaxError = values.slug
        ? validateSiteWizard(values, 0).slug
        : undefined;
    const slugError =
        errors.slug ||
        slugSyntaxError ||
        (availability.state === 'unavailable' ? availability.reason : undefined);

    function next() {
        const found = validateSiteWizard(values, step);
        if (step === 0 && availability.state !== 'available') {
            found.slug =
                found.slug ||
                (availability.state === 'checking'
                    ? 'Still checking availability…'
                    : availability.state === 'unavailable'
                      ? availability.reason
                      : 'Could not confirm this name is available. Try again.');
        }
        if (Object.keys(found).length) return setErrors(found);
        setErrors({});
        setStep(step + 1);
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        // Enter on an earlier step advances the wizard instead of submitting it.
        if (step < WIZARD_STEPS.length - 1) {
            event.preventDefault();
            return next();
        }
        const found = validateSiteWizard(values);
        if (Object.keys(found).length) {
            event.preventDefault();
            setErrors(found);
            const first = [0, 1, 2, 3, 4].find((index) =>
                Object.keys(validateSiteWizard(values, index)).length,
            );
            if (first !== undefined) setStep(first);
        }
    }

    const planName = plans.find((plan) => plan.id === values.planId)?.name;

    return (
        <form
            action={action}
            onSubmit={onSubmit}
            className="mt-8 portal-stack portal-panel-padding portal-surface"
            noValidate
        >
            <input type="hidden" name="requestKey" value={requestKey} />
            {/* Every step's answers travel with the final submit. */}
            {(
                [
                    'slug',
                    'companyName',
                    'country',
                    'currency',
                    'coaType',
                    'planId',
                    'email',
                    'password',
                    'confirmPassword',
                ] as const
            ).map((key) => (
                <input key={key} type="hidden" name={key} value={values[key]} />
            ))}
            {values.apps.map((id) => (
                <input key={id} type="hidden" name="apps" value={id} />
            ))}

            <StepIndicator labels={[...WIZARD_STEPS]} step={step + 1} />

            {step === 0 && (
                <div className="space-y-5">
                    <FormField
                        id="slug"
                        label="Site name"
                        error={slugError}
                        help="Lowercase letters, numbers and hyphens, e.g. acme."
                    >
                        <Input
                            id="slug"
                            value={values.slug}
                            onChange={(event) =>
                                set('slug', event.target.value.toLowerCase())
                            }
                            maxLength={48}
                            autoComplete="off"
                            aria-invalid={Boolean(slugError)}
                            placeholder="acme"
                        />
                    </FormField>
                    <div aria-live="polite" className="portal-text-caption">
                        {availability.state === 'checking' && (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                                <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
                                Checking availability…
                            </span>
                        )}
                        {availability.state === 'available' &&
                            !slugSyntaxError && (
                                <span className="inline-flex items-center gap-2 text-success">
                                    <Check className="size-3.5" />
                                    Available
                                </span>
                            )}
                        {availability.state === 'error' && (
                            <span className="text-muted-foreground">
                                Could not check availability right now.
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="portal-text-caption text-muted-foreground">
                            Your site address
                        </p>
                        <p className="mt-1 break-all font-mono portal-text-body text-foreground">
                            {(values.slug || 'your-site') +
                                (domainSuffix ? '.' + domainSuffix : '')}
                        </p>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-5">
                    <FormField
                        id="companyName"
                        label="Company name"
                        error={errors.companyName}
                    >
                        <Input
                            id="companyName"
                            value={values.companyName}
                            onChange={(event) =>
                                set('companyName', event.target.value)
                            }
                            maxLength={100}
                            aria-invalid={Boolean(errors.companyName)}
                        />
                    </FormField>
                    <FormField id="country" label="Country" error={errors.country}>
                        <Select
                            value={values.country}
                            onValueChange={(value) => set('country', value)}
                        >
                            <SelectTrigger id="country" aria-invalid={Boolean(errors.country)}>
                                <SelectValue placeholder="Select a country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {FRAPPE_COUNTRIES.map((country) => (
                                    <SelectItem key={country} value={country}>
                                        {country}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField id="currency" label="Currency" error={errors.currency}>
                        <Select
                            value={values.currency}
                            onValueChange={(value) => set('currency', value)}
                        >
                            <SelectTrigger id="currency" aria-invalid={Boolean(errors.currency)}>
                                <SelectValue placeholder="Select a currency" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {currencies.map((currency) => (
                                    <SelectItem key={currency.code} value={currency.code}>
                                        {currency.code} — {currency.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField
                        id="coaType"
                        label="Chart of accounts"
                        error={errors.coaType}
                    >
                        <Select
                            value={values.coaType}
                            onValueChange={(value) => set('coaType', value)}
                        >
                            <SelectTrigger id="coaType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COA_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                </div>
            )}

            {step === 2 && (
                <fieldset>
                    <legend className="portal-text-body font-semibold">
                        Choose your AlgoSuite plan
                    </legend>
                    {plans.length === 0 && (
                        <Notice tone="warning" className="mt-4">
                            No plans are available yet. Contact support.
                        </Notice>
                    )}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {plans.map((plan) => (
                            <button
                                key={plan.id}
                                type="button"
                                aria-pressed={values.planId === plan.id}
                                onClick={() => set('planId', plan.id)}
                                className={cn(
                                    'rounded-lg border p-4 text-left transition-colors',
                                    values.planId === plan.id
                                        ? 'border-foreground bg-muted'
                                        : 'border-border',
                                )}
                            >
                                <span className="flex items-center justify-between gap-3">
                                    <span className="font-semibold">{plan.name}</span>
                                    {values.planId === plan.id && <Check className="size-4" />}
                                </span>
                                <span className="mt-1 block portal-text-body text-foreground/70">
                                    {plan.price}
                                </span>
                                {plan.tagline && (
                                    <span className="mt-2 block portal-text-caption text-muted-foreground">
                                        {plan.tagline}
                                    </span>
                                )}
                                <span className="mt-2 block portal-text-caption text-muted-foreground">
                                    {plan.userLimit == null
                                        ? 'Unlimited users'
                                        : `Up to ${plan.userLimit} users`}
                                </span>
                                {(plan.vcpu != null || plan.ramMb != null || plan.storageGb != null) && (
                                    <span className="mt-1 block portal-text-caption text-muted-foreground">
                                        {[
                                            plan.vcpu != null && `${plan.vcpu} vCPU`,
                                            plan.ramMb != null && `${plan.ramMb / 1024} GB RAM`,
                                            plan.storageGb != null && `${plan.storageGb} GB storage`,
                                        ].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    {errors.planId && (
                        <p role="alert" className="mt-3 text-xs text-destructive">
                            {errors.planId}
                        </p>
                    )}
                </fieldset>
            )}

            {step === 3 && (
                <fieldset>
                    <legend className="portal-text-body font-semibold">Applications</legend>
                    <p className="mt-2 portal-text-caption text-muted-foreground">
                        Frappe and ERPNext are included. Select additional
                        applications to install.
                    </p>
                    <div className="mt-4 space-y-3">
                        {apps.map((app) => (
                            <label
                                key={app.id}
                                className={`flex items-center justify-between gap-3 rounded-lg border border-border p-4 portal-text-body ${app.available ? '' : 'text-muted-foreground'}`}
                            >
                                <span className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        disabled={!app.available}
                                        checked={values.apps.includes(app.id)}
                                        onChange={(event) =>
                                            set(
                                                'apps',
                                                event.target.checked
                                                    ? [...values.apps, app.id]
                                                    : values.apps.filter((id) => id !== app.id),
                                            )
                                        }
                                        className="size-4 accent-foreground"
                                    />
                                    {app.name}
                                </span>
                                {!app.available && (
                                    <span className="portal-text-caption">Requires setup</span>
                                )}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            {step === 4 && (
                <div className="space-y-5">
                    <FormField
                        id="email"
                        label="Email address"
                        error={errors.email}
                        help="You will sign in to your ERP with this email."
                    >
                        <Input
                            id="email"
                            type="email"
                            value={values.email}
                            onChange={(event) => set('email', event.target.value)}
                            autoComplete="email"
                            aria-invalid={Boolean(errors.email)}
                        />
                    </FormField>
                    <FormField
                        id="password"
                        label="Password"
                        error={errors.password}
                        help="At least 12 characters."
                    >
                        <PasswordInput
                            id="password"
                            value={values.password}
                            onChange={(event) => set('password', event.target.value)}
                            autoComplete="new-password"
                            maxLength={128}
                            aria-invalid={Boolean(errors.password)}
                        />
                    </FormField>
                    <FormField
                        id="confirmPassword"
                        label="Confirm password"
                        error={errors.confirmPassword}
                    >
                        <PasswordInput
                            id="confirmPassword"
                            value={values.confirmPassword}
                            onChange={(event) =>
                                set('confirmPassword', event.target.value)
                            }
                            autoComplete="new-password"
                            maxLength={128}
                            aria-invalid={Boolean(errors.confirmPassword)}
                        />
                    </FormField>
                    <p className="portal-text-caption text-muted-foreground">
                        {values.slug}
                        {domainSuffix ? '.' + domainSuffix : ''} · {values.companyName} · {planName}
                    </p>
                </div>
            )}

            <div className="border-t border-border pt-5">
                {state?.error && (
                    <Notice tone="error" className="mb-4">
                        {state.error}
                    </Notice>
                )}
                <div className="flex items-center justify-between gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(step - 1)}
                        className={step === 0 ? 'invisible' : undefined}
                    >
                        <ArrowLeft className="size-4" /> Back
                    </Button>
                    {step < WIZARD_STEPS.length - 1 ? (
                        <Button type="button" onClick={next}>
                            Next <ArrowRight className="size-4" />
                        </Button>
                    ) : (
                        <CreateButton disabled={!available} />
                    )}
                </div>
                {step === WIZARD_STEPS.length - 1 && (
                    <p className="mt-4 portal-text-caption text-muted-foreground">
                        Installation runs in the background. You can follow the
                        progress on your site page and by email.
                    </p>
                )}
            </div>
        </form>
    );
}
