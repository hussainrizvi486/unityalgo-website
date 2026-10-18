import type { TenantStatus } from '@/lib/controller-client';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

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
