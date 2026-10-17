import type { CustomerSite } from '@/lib/controller-client';

/** Statuses a site rests in. Anything else means something is being set up or changed. */
export const RESTING_STATUSES = ['ready', 'stopped', 'deactivated', 'failed', 'cleanup_required'];

/** True while the site is changing (installing, stopping, backing up…), so the live view checks more often. */
export const siteIsBusy = (site: Pick<CustomerSite, 'status' | 'activity'>) =>
    !RESTING_STATUSES.includes(site.status) || Boolean(site.activity);
