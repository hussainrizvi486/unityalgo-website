import { Suspense } from 'react';
import { requireCustomer } from '@/lib/customer-session';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const user = await requireCustomer();

  return (
    <Suspense>
      <SettingsClient
        profile={{
          firstName: user.firstName || user.name || '',
          lastName: user.lastName || '',
          email: user.email,
          username: user.username ?? '',
          phone: user.phone ?? '',
          company: user.company ?? '',
          companyEmail: user.companyEmail ?? '',
        }}
      />
    </Suspense>
  );
}
