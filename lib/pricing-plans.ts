import type { Plan } from '@/db/types';
import type { PriceCurrency } from '@/lib/pricing';

/** What a plan's stored metadata says about it: `{ category, features: { points, support, resources: { cpu, ram, storage } } }`. */
export interface PlanDetails {
    category: string | null;
    points: string[];
    support: string | null;
    resources: { cpu: string | null; ram: string | null; storage: string | null };
}

/** Public catalog fields only; billing provider IDs stay on the server. */
export type PricingPlan = Pick<Plan,
    'id' | 'name' | 'tagline' | 'priceAmount' | 'priceUnit' | 'transactionFeePercent' |
    'userLimit' | 'features' | 'trialDays' | 'vcpu' | 'ramMb' | 'storageGb'
> & { currency?: PriceCurrency | null; details: PlanDetails };

const MAX_POINTS = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, max = 120) {
    const result = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
    return result.trim().replace(/\s+/g, ' ').slice(0, max) || null;
}

/** The display details of a stored metadata value. Anything unexpected is ignored, never thrown on. */
export function readPlanDetails(raw: unknown): PlanDetails {
    const features = isRecord(raw) && isRecord(raw.features) ? raw.features : {};
    const resources = isRecord(features.resources) ? features.resources : {};
    const points: string[] = [];
    for (const item of Array.isArray(features.points) ? features.points : []) {
        const point = text(item);
        if (point && !points.some((existing) => existing.toLowerCase() === point.toLowerCase())) points.push(point);
    }
    return {
        category: isRecord(raw) ? text(raw.category, 40) : null,
        points: points.slice(0, MAX_POINTS),
        support: text(features.support, 40),
        resources: { cpu: text(resources.cpu, 40), ram: text(resources.ram, 40), storage: text(resources.storage, 40) },
    };
}

/** A catalog plan with its display details read from its metadata. */
export function withPlanDetails<T extends { metadata: unknown }>(plan: T): T & { details: PlanDetails } {
    return { ...plan, details: readPlanDetails(plan.metadata) };
}

// The catalog supports bundled features and label:value details. Metadata points come first.
export function planFeatureValues(plan: Pick<PricingPlan, 'features' | 'details'>) {
    const values = new Map<string, { label: string; value: string | true }>();
    for (const point of plan.details.points) values.set(point.toLowerCase(), { label: point, value: true });
    for (const feature of plan.features) {
        const [label, ...rest] = feature.split(':');
        const name = label.trim();
        if (!name || values.has(name.toLowerCase())) continue;
        const value = rest.join(':').trim();
        values.set(name.toLowerCase(), { label: name, value: value || true });
    }
    return values;
}

function memory(megabytes: number) {
    return megabytes >= 1024 && megabytes % 1024 === 0 ? `${megabytes / 1024} GB` : `${megabytes} MB`;
}

/** CPU, memory and storage as the plan states them, falling back to the numeric plan limits. */
export function planResources(plan: Pick<PricingPlan, 'details' | 'vcpu' | 'ramMb' | 'storageGb'>) {
    const { resources } = plan.details;
    return [
        { key: 'cpu', label: 'CPU', value: resources.cpu ?? (plan.vcpu != null ? `${plan.vcpu} vCPU` : null) },
        { key: 'ram', label: 'Memory', value: resources.ram ?? (plan.ramMb != null ? memory(plan.ramMb) : null) },
        { key: 'storage', label: 'Storage', value: resources.storage ?? (plan.storageGb != null ? `${plan.storageGb} GB` : null) },
    ].filter((resource): resource is { key: string; label: string; value: string } => resource.value != null);
}

export function pricingPlanAction(plan: PricingPlan) {
    const quote = plan.priceAmount == null && !plan.trialDays;
    return {
        href: quote ? '/#contact' : `/register?plan=${encodeURIComponent(plan.id)}`,
        label: quote ? 'Contact sales' : plan.trialDays ? 'Start free trial' : 'Choose plan',
    };
}
