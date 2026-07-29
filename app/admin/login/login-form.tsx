'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { loginAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full rounded-full bg-brand-600 hover:bg-brand-700 text-white h-11">
            {pending ? 'Signing in...' : 'Sign In'}
        </Button>
    );
}

export function LoginForm() {
    const [state, formAction] = useActionState(loginAction, undefined);

    return (
        <form action={formAction} className="space-y-4">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                </label>
                <Input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                </label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <SubmitButton />
        </form>
    );
}
