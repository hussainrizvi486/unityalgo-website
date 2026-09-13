import { getSubscriptions } from '@/app/customer/actions';
import { requireCustomer } from '@/lib/customer-session';
import { OverviewClient } from './overview-client';

export default async function CustomerOverviewPage() {
  const user = await requireCustomer();
  const subscriptions = await getSubscriptions(user.id);

  return (
    <OverviewClient
      profile={{
        firstName: user.firstName || user.name || 'Customer',
        lastName: user.lastName || '',
        email: user.email,
      }}
      subscriptions={subscriptions.map((subscription) => ({
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        plan: subscription.plan,
        addOns: subscription.addOns.map((row) => row.addOn),
      }))}
    />
  );
}
