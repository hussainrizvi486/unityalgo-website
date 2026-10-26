import { findCountry } from '@/lib/countries';
import { COA_TYPES } from '@/lib/site-wizard';

/** Values the site wizard starts with when a customer picks the plan. Every key is optional. */
export interface PlanDefaults {
    country?: string;
    currency?: string;
    coaType?: string;
}

export interface PlanMetadata {
    defaults: PlanDefaults;
}

const DEFAULT_KEYS = ['country', 'currency', 'coaType'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the site wizard may use from a stored value. Anything unexpected is ignored, never thrown on. */
export function readPlanMetadata(raw: unknown): PlanMetadata {
    const defaults: PlanDefaults = {};
    const source = isRecord(raw) && isRecord(raw.defaults) ? raw.defaults : {};
    const country = typeof source.country === 'string' ? findCountry(source.country) : null;
    if (country) defaults.country = country;
    if (typeof source.currency === 'string' && /^[A-Za-z]{3}$/.test(source.currency)) defaults.currency = source.currency.toUpperCase();
    if (typeof source.coaType === 'string' && COA_TYPES.some((type) => type.value === source.coaType)) defaults.coaType = source.coaType;
    return { defaults };
}

export type PlanMetadataResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

/** The admin's JSON text, checked strictly so a typo is reported instead of silently ignored. Blank means no metadata. */
export function parsePlanMetadataText(text: string): PlanMetadataResult {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, value: {} };
    if (trimmed.length > 10_000) return { ok: false, error: 'Metadata must be 10,000 characters or fewer.' };
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (error) {
        return { ok: false, error: `Metadata is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}.` };
    }
    if (!isRecord(parsed)) return { ok: false, error: 'Metadata must be a JSON object, for example {"defaults": {"country": "Pakistan"}}.' };
    if (parsed.defaults !== undefined) {
        if (!isRecord(parsed.defaults)) return { ok: false, error: '"defaults" must be an object.' };
        for (const key of Object.keys(parsed.defaults)) {
            if (!(DEFAULT_KEYS as readonly string[]).includes(key))
                return { ok: false, error: `"defaults.${key}" is not a known setting. Use ${DEFAULT_KEYS.join(', ')}.` };
        }
        const { country, currency, coaType } = parsed.defaults;
        if (country !== undefined && (typeof country !== 'string' || !findCountry(country)))
            return { ok: false, error: `"defaults.country" is not a known country: ${JSON.stringify(country)}.` };
        if (currency !== undefined && (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)))
            return { ok: false, error: '"defaults.currency" must be a 3-letter currency code such as "USD".' };
        if (coaType !== undefined && !COA_TYPES.some((type) => type.value === coaType))
            return { ok: false, error: `"defaults.coaType" must be one of: ${COA_TYPES.map((type) => type.value).join(', ')}.` };
    }
    return { ok: true, value: parsed };
}

export interface WizardDefaultsTarget {
    country: string;
    currency: string;
    coaType: string;
}

/**
 * The wizard values after a plan's defaults are applied. A field the customer has changed themselves is left alone, and a
 * currency the shop does not offer is skipped.
 */
export function applyPlanDefaults<T extends WizardDefaultsTarget>(
    values: T,
    defaults: PlanDefaults,
    changed: { country: boolean; currency: boolean; coaType: boolean },
    offeredCurrencies: string[],
): T {
    const next = { ...values };
    if (defaults.country && !changed.country) next.country = defaults.country;
    if (defaults.currency && !changed.currency && offeredCurrencies.includes(defaults.currency)) next.currency = defaults.currency;
    if (defaults.coaType && !changed.coaType) next.coaType = defaults.coaType;
    return next;
}
