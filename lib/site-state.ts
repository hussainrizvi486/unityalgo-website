import type { CustomerSite } from '@/lib/controller-client';

const RESTING_STATUSES = ['ready', 'stopped', 'deactivated', 'failed', 'cleanup_required'];

export const siteIsBusy = (site: Pick<CustomerSite, 'status' | 'activity'>) =>
    !RESTING_STATUSES.includes(site.status) || Boolean(site.activity);
