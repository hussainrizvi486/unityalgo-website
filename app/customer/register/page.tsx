import { Suspense } from 'react';
import { CustomerAuthForm } from '@/components/customer/auth-form';

export default function CustomerRegisterPage() {
  return <Suspense><CustomerAuthForm mode="register" /></Suspense>;
}
