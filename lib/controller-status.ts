import type { TenantStatus } from '@/lib/controller-client';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

/**
 * Display mappings for controller-side status vocabularies.
 *
 * Mirrors lib/tickets.ts — the controller uses its own lowercase status
 * strings rather than the Prisma enums the rest of the admin panel uses, so
 * the translation to labels and badge variants lives in one place instead of
 * being repeated in every page that renders one.
 */

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
    pending: 'Pending',
    active: 'Active',
    paused: 'Paused',
    terminated: 'Terminated',
};

export const TENANT_STATUS_BADGE: Record<TenantStatus, BadgeVariant> = {
    pending: 'warning',
    active: 'success',
    paused: 'neutral',
    terminated: 'error',
};

/** Deployment lifecycle, as reported on a tenant's live deployment. */
export const DEPLOYMENT_STATUS_BADGE: Record<string, BadgeVariant> = {
    pending: 'warning',
    deploying: 'warning',
    health_checking: 'warning',
    live: 'success',
    stopped: 'neutral',
    draining: 'warning',
    failed: 'error',
    removed: 'neutral',
};

/** ActivityLogger's own status vocabulary (not stdlib log levels). */
export const OPERATION_STATUS_BADGE: Record<string, BadgeVariant> = {
    pending: 'neutral',
    in_progress: 'info',
    success: 'success',
    failed: 'error',
    warning: 'warning',
};

export const DOMAIN_STATUS_BADGE: Record<string, BadgeVariant> = {
    pending: 'warning',
    active: 'success',
    disabled: 'neutral',
};

export function humanizeStatus(status: string) {
    return status.replace(/_/g, ' ');
}
