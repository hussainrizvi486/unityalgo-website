import { MAX_MODULES, MODULE_NAME } from '@/lib/app-modules';

/**
 * What a plan allows on the sites that run it, from the `restrictions` object of its metadata:
 * `{ "restrictions": { "modules": ["Accounting"], "roles": ["Accounts User"] } }`.
 * No restrictions means the plan changes nothing on the site.
 */
export interface PlanRestrictions {
    modules: string[];
    roles: string[];
}

const KEYS = ['modules', 'roles'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

function names(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const list: string[] = [];
    for (const item of value) {
        const name = typeof item === 'string' ? clean(item) : '';
        if (MODULE_NAME.test(name) && !list.includes(name)) list.push(name);
    }
    return list.slice(0, MAX_MODULES);
}

/** The restrictions of a stored metadata value. Anything unexpected is ignored, never thrown on. */
export function readPlanRestrictions(raw: unknown): PlanRestrictions {
    const source = isRecord(raw) && isRecord(raw.restrictions) ? raw.restrictions : {};
    return { modules: names(source.modules), roles: names(source.roles) };
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
    if (!isRecord(parsed)) return { ok: false, error: 'Metadata must be a JSON object, for example {"restrictions": {"modules": ["Accounting"]}}.' };
    if (parsed.restrictions === undefined) return { ok: true, value: parsed };
    if (!isRecord(parsed.restrictions)) return { ok: false, error: '"restrictions" must be an object.' };
    for (const key of Object.keys(parsed.restrictions)) {
        if (!(KEYS as readonly string[]).includes(key)) return { ok: false, error: `"restrictions.${key}" is not a known setting. Use ${KEYS.join(' and ')}.` };
    }
    for (const key of KEYS) {
        const list = parsed.restrictions[key];
        if (list === undefined) continue;
        if (!Array.isArray(list)) return { ok: false, error: `"restrictions.${key}" must be a list of names.` };
        if (list.length > MAX_MODULES) return { ok: false, error: `"restrictions.${key}" can hold at most ${MAX_MODULES} names.` };
        for (const item of list) {
            if (typeof item !== 'string' || !MODULE_NAME.test(clean(item)))
                return { ok: false, error: `"restrictions.${key}" has an invalid name: ${JSON.stringify(item)}. Use letters, numbers, spaces and - _ & . ( ) only, up to 60 characters.` };
        }
    }
    return { ok: true, value: parsed };
}
