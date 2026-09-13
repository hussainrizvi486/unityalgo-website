import { requireCustomer } from '@/lib/customer-session';
import { ProfileForm } from './profile-form';

export default async function EditProfilePage() {
  const user = await requireCustomer();

  return (
    <ProfileForm
      firstName={user.firstName || user.name || ''}
      lastName={user.lastName || ''}
      username={user.username ?? ''}
      phone={user.phone ?? ''}
      company={user.company ?? ''}
      companyEmail={user.companyEmail ?? ''}
    />
  );
}
