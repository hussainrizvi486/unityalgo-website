import { FRAPPE_COUNTRIES } from '@/lib/frappe-countries';

export const COA_TYPES = [
    { value: 'standard', label: 'Standard' },
    { value: 'numbered', label: 'Numbered (Standard with account numbers)' },
] as const;

const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

export interface SiteWizardValues {
    slug: string;
    companyName: string;
    country: string;
    currency: string;
    coaType: string;
    planId: string;
    apps: string[];
    email: string;
    password: string;
    confirmPassword: string;
}

export type SiteWizardErrors = Partial<Record<keyof SiteWizardValues, string>>;

/** Words that end a company name but make a poor web address ("Acme Trading Pvt Ltd" becomes "acme-trading"). */
const LEGAL_SUFFIXES = new Set(['ltd', 'limited', 'llc', 'llp', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'pvt', 'private', 'pty', 'plc', 'gmbh', 'smc', 'ag', 'bv', 'sa']);

/**
 * A valid site name suggested from a company name, or an empty string when nothing sensible can be made.
 * Lowercase letters, numbers and single hyphens, starting with a letter, 3 to 48 characters.
 */
export function slugFromName(name: string) {
    const words = name
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/&/g, ' and ')
        .split(/[^a-z0-9]+/).filter(Boolean);
    const trimmed = [...words];
    while (trimmed.length > 1 && LEGAL_SUFFIXES.has(trimmed[trimmed.length - 1])) trimmed.pop();
    let slug = trimmed.join('-').replace(/^[^a-z]+/, '').slice(0, 48).replace(/-+$/, '');
    if (slug.length < 3) slug = words.join('-').replace(/^[^a-z]+/, '').slice(0, 48).replace(/-+$/, '');
    return slug.length >= 3 && SLUG_PATTERN.test(slug) ? slug : '';
}

export const WIZARD_STEPS = ['Site', 'Company', 'Plan', 'Apps', 'Account'] as const;

/** Fields checked at each step (index = step number - 1). */
const STEP_FIELDS: (keyof SiteWizardValues)[][] = [
    ['slug'],
    ['companyName', 'country', 'currency', 'coaType'],
    ['planId'],
    [],
    ['email', 'password', 'confirmPassword'],
];

export function validateSiteWizard(
    v: SiteWizardValues,
    step?: number,
): SiteWizardErrors {
    const e: SiteWizardErrors = {};
    if (v.slug.length < 3 || v.slug.length > 48 || !SLUG_PATTERN.test(v.slug))
        e.slug =
            'Use 3–48 lowercase letters, numbers and single hyphens, starting with a letter.';
    if (!v.companyName.trim()) e.companyName = 'Company name is required.';
    else if (v.companyName.trim().length > 100)
        e.companyName = 'Company name must be 100 characters or fewer.';
    if (!(FRAPPE_COUNTRIES as readonly string[]).includes(v.country))
        e.country = 'Choose a country.';
    if (!v.currency) e.currency = 'Choose a currency.';
    if (!COA_TYPES.some((t) => t.value === v.coaType))
        e.coaType = 'Choose a chart of accounts type.';
    if (!v.planId) e.planId = 'Select a plan to continue.';
    if (!EMAIL.test(v.email.trim())) e.email = 'Enter a valid email address.';
    if (v.password.length < 12 || v.password.length > 128)
        e.password = 'Password must be 12–128 characters.';
    if (v.password !== v.confirmPassword)
        e.confirmPassword = 'Passwords do not match.';
    if (step === undefined) return e;
    const allowed = new Set(STEP_FIELDS[step]);
    return Object.fromEntries(
        Object.entries(e).filter(([key]) => allowed.has(key as keyof SiteWizardValues)),
    );
}
