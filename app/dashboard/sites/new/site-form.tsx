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
import { isCompatible, upgradeTarget, type PlanTier } from '@/lib/app-compatibility';
import { StepIndicator } from '@/components/customer/step-indicator';
import { CountrySelect } from '@/components/ui/country-select';
import { Autocomplete } from '@/components/ui/autocomplete';
import { currencyOfCountry, findCountry, guessCountry } from '@/lib/countries';
import {
    COA_TYPES,
    WIZARD_STEPS,
    validateSiteWizard,
    type SiteWizardValues,
    slugFromName,
} from '@/lib/site-wizard';
import { applyPlanDefaults, type PlanDefaults } from '@/lib/plan-metadata';
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
    /** Values the plan pre-fills in the company step. */
    defaults: PlanDefaults;
    /** Days of free trial on offer to this customer, 0 for none. */
    trialDays: number;
    /** The plan has a trial but this customer has used it. */
    trialUsed: boolean;
    /** Cannot be chosen: the plan is only a free trial and this customer has had it. */
    unavailable: boolean;
}

type Availability =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'available' }
    | { state: 'unavailable'; reason: string }
    | { state: 'error' };

function CreateButton({ disabled, covered }: { disabled: boolean; covered: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? 'Saving site details…' : covered ? 'Create site' : 'Continue to payment'}
        </Button>
    );
}

export function SiteForm({
    requestKey,
    apps,
    tiers,
    plans,
    currencies,
    available,
    domainSuffix,
    selectedApp,
    selectedPlan,
    idlePlanIds = [],
    defaultCountry,
    defaultCompany = '',
}: {
    requestKey: string;
    apps: { id: string; name: string; available: boolean; minPlanId: string | null }[];
    /** Every plan's tier, so an app can say which plan it needs. */
    tiers: PlanTier[];
    plans: PlanOption[];
    currencies: { code: string; name: string; symbol: string }[];
    available: boolean;
    domainSuffix: string;
    selectedApp?: string;
    selectedPlan?: string;
    /** Plans the customer already pays for with no site running on them. */
    idlePlanIds?: string[];
    defaultCountry?: string | null;
    /** The company name given at registration: the starting point for the company and the site name. */
    defaultCompany?: string;
}) {
    const [state, action] = useActionState(createSiteAction, undefined);
    const [step, setStep] = useState(0);
    // The currency a country usually uses, when this shop offers it.
    const currencyFor = (country: string) => {
        const code = currencyOfCountry(country);
        return code && currencies.some((currency) => currency.code === code) ? code : '';
    };
    const currencyOptions = currencies.map((currency) => ({
        value: currency.code,
        label: `${currency.code} — ${currency.name}`,
        icon: <span className="w-8 shrink-0 text-center font-semibold">{currency.symbol}</span>,
        keywords: [currency.symbol, currency.name],
    }));
    const startCountry = findCountry(defaultCountry) ?? '';
    const initialPlan = plans.find((plan) => plan.id === selectedPlan && !plan.unavailable);
    const [values, setValues] = useState<SiteWizardValues>(() => applyPlanDefaults({
        slug: slugFromName(defaultCompany),
        companyName: defaultCompany,
        country: startCountry,
        currency: currencyFor(startCountry),
        coaType: 'standard',
        planId: plans.find((plan) => plan.id === selectedPlan && !plan.unavailable)?.id ?? '',
        apps: apps
            .filter((app) => app.available && app.id === selectedApp && isCompatible(app, tiers.find((tier) => tier.id === selectedPlan), tiers))
            .map((app) => app.id),
        email: '',
        password: '',
        confirmPassword: '',
    }, initialPlan?.defaults ?? {}, { country: false, currency: false, coaType: false }, currencies.map((currency) => currency.code)));
    // Fields the customer has edited: a plan's defaults never overwrite these.
    const changed = useRef({ country: false, coaType: false });
    // A plan chosen before the wizard (pricing page, plans page, or an unused subscription) is kept: the plan step is
    // skipped unless the customer asks to change it.
    const [planLocked, setPlanLocked] = useState(Boolean(values.planId));
    const planIsCovered = idlePlanIds.includes(values.planId);
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

    const currencyChosen = useRef(false);
    useEffect(() => {
        if (startCountry) return;
        const guess = guessCountry();
        if (!guess) return;
        const timer = setTimeout(() => {
            setValues((current) => current.country
                ? current
                : { ...current, country: guess, currency: currencyChosen.current ? current.currency : currencyFor(guess) || current.currency });
        }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        setStep(planLocked && step === 1 ? 3 : step + 1);
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

            <StepIndicator labels={[...WIZARD_STEPS, 'Payment']} step={step + 1} />

            {planLocked && step !== 2 && planName && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
                    <div className="min-w-0">
                        <p className="portal-text-caption text-muted-foreground">Selected plan</p>
                        <p className="font-semibold">
                            {planName}
                            {plans.find((plan) => plan.id === values.planId)?.price ? <span className="font-normal text-muted-foreground"> · {plans.find((plan) => plan.id === values.planId)?.price}</span> : null}
                        </p>
                        {planIsCovered && <p className="portal-text-caption text-success">You already pay for this plan, so this site needs no new payment.</p>}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setPlanLocked(false); setStep(2); }}>Change</Button>
                </div>
            )}

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
                        <CountrySelect
                            id="country"
                            value={values.country}
                            invalid={Boolean(errors.country)}
                            onValueChange={(value) => {
                                changed.current.country = true;
                                set('country', value);
                                // The currency follows the country until the customer picks one themselves.
                                if (!currencyChosen.current && currencyFor(value)) set('currency', currencyFor(value));
                            }}
                        />
                    </FormField>
                    <FormField id="currency" label="Currency" error={errors.currency}>
                        <Autocomplete
                            id="currency"
                            value={values.currency}
                            invalid={Boolean(errors.currency)}
                            options={currencyOptions}
                            placeholder="Select a currency"
                            searchPlaceholder="Search currencies…"
                            emptyMessage="No currency matches that."
                            onValueChange={(value) => {
                                currencyChosen.current = true;
                                set('currency', value);
                            }}
                        />
                    </FormField>
                    <FormField
                        id="coaType"
                        label="Chart of accounts"
                        error={errors.coaType}
                    >
                        <Select
                            value={values.coaType}
                            onValueChange={(value) => {
                                changed.current.coaType = true;
                                set('coaType', value);
                            }}
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
                                disabled={plan.unavailable}
                                onClick={() => {
                                    setValues((current) => applyPlanDefaults({
                                        ...current,
                                        planId: plan.id,
                                        apps: current.apps.filter((id) => {
                                            const app = apps.find((candidate) => candidate.id === id);
                                            return !app || isCompatible(app, tiers.find((tier) => tier.id === plan.id), tiers);
                                        }),
                                    }, plan.defaults, { ...changed.current, currency: currencyChosen.current }, currencies.map((currency) => currency.code)));
                                    setErrors((current) => ({ ...current, planId: undefined }));
                                }}
                                className={cn(
                                    'rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
                                {idlePlanIds.includes(plan.id) && (
                                    <span className="mt-1 block portal-text-caption font-medium text-success">Already included in your subscription</span>
                                )}
                                {plan.trialDays > 0 && (
                                    <span className="mt-2 inline-block rounded-full bg-success/10 px-2 py-0.5 portal-text-caption font-semibold text-success">
                                        {plan.trialDays}-day free trial
                                    </span>
                                )}
                                {plan.trialUsed && (
                                    <span className="mt-2 block portal-text-caption text-muted-foreground">
                                        {plan.unavailable ? 'Free trial already used.' : 'Free trial already used. Subscribe to this plan first.'}
                                    </span>
                                )}
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
                        AlgoSuite is included. Select additional
                        applications to install.
                    </p>
                    <div className="mt-4 space-y-3">
                        {apps.map((app) => {
                            const needed = upgradeTarget(app, tiers.find((tier) => tier.id === values.planId), tiers);
                            const disabled = !app.available || Boolean(needed);
                            return (
                                <label
                                    key={app.id}
                                    className={`flex items-center justify-between gap-3 rounded-lg border border-border p-4 portal-text-body ${disabled ? 'text-muted-foreground' : ''}`}
                                >
                                    <span className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            disabled={disabled}
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
                                    {!app.available ? (
                                        <span className="portal-text-caption">Requires setup</span>
                                    ) : needed ? (
                                        <span className="flex items-center gap-2 portal-text-caption">
                                            Needs {needed.name} or higher
                                            <button type="button" className="font-semibold text-primary underline" onClick={() => { setPlanLocked(false); setStep(2); }}>Change plan</button>
                                        </span>
                                    ) : null}
                                </label>
                            );
                        })}
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
                        onClick={() => setStep(planLocked && step === 3 ? 1 : step - 1)}
                        className={step === 0 ? 'invisible' : undefined}
                    >
                        <ArrowLeft className="size-4" /> Back
                    </Button>
                    {step < WIZARD_STEPS.length - 1 ? (
                        <Button type="button" onClick={next}>
                            Next <ArrowRight className="size-4" />
                        </Button>
                    ) : (
                        <CreateButton disabled={!available} covered={planIsCovered} />
                    )}
                </div>
                {step === WIZARD_STEPS.length - 1 && (
                    <p className="mt-4 portal-text-caption text-muted-foreground">
                        Your site details are saved before payment. Installation starts only after payment is confirmed. Free trial plans do not require a payment.
                    </p>
                )}
            </div>
        </form>
    );
}
