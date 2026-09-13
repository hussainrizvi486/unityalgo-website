import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CustomerAuthForm } from '@/components/customer/auth-form';

export const metadata: Metadata = {
    title: 'Sign in | UnityAlgo',
    description: 'Sign in to your UnityAlgo account.',
    robots: { index: false, follow: false },
};

/**
 * The single sign-in page, for admins and customers alike.
 *
 * There used to be two — /admin/login and /customer/login — which meant an
 * admin who followed a customer link hit a form that would reject them by
 * role rather than by password. One page now takes any account and the action
 * routes on the role behind it.
 */
export default function LoginPage() {
    // Suspense: the form reads `next` and `reset` from the query string.
    return (
        <Suspense>
            <CustomerAuthForm />
        </Suspense>
    );
}
