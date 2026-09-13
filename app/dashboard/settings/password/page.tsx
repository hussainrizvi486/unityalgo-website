import { requireCustomerSession } from '@/lib/customer-session';
import { PasswordForm } from './password-form';

export default async function ChangePasswordPage() {
  await requireCustomerSession();

  return <PasswordForm />;
}
