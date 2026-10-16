import type { LeadStatus, LeadSource } from '@/db/types';

type BadgeVariant = 'neutral' | 'success' | 'info' | 'warning' | 'error' | 'brand';

/** One place for the vocabulary, so the list, the form and any future
 *  dashboard tile all label a lead the same way. */
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    QUALIFIED: 'Qualified',
    CONVERTED: 'Converted',
    LOST: 'Lost',
};

export const LEAD_STATUS_BADGE_VARIANT: Record<LeadStatus, BadgeVariant> = {
    NEW: 'info',
    CONTACTED: 'warning',
    QUALIFIED: 'brand',
    CONVERTED: 'success',
    LOST: 'neutral',
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
    CONTACT_FORM: 'Contact form',
    IMPORT: 'Imported',
    MANUAL: 'Added manually',
};

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;
