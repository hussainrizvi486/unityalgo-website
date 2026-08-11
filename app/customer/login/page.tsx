import { Suspense } from 'react';
import { CustomerAuthForm } from '@/components/customer/auth-form';

export default function CustomerLoginPage() {
  return <Suspense><CustomerAuthForm mode="login" /></Suspense>;
}
