import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/customer/auth-form';

export const metadata: Metadata = {
    title: 'Sign in | UnityAlgo',
    description: 'Sign in to your UnityAlgo account.',
    robots: { index: false, follow: false },
};

export default function LoginPage() {
    // Suspense: the form reads `next` and `reset` from the query string.
    return (
        <Suspense>
            <CustomerAuthForm />
        </Suspense>
    );
}
