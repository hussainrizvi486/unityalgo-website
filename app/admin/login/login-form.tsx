'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { loginAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full rounded-full bg-brand hover:brightness-90 text-white h-11">
            {pending ? 'Signing in...' : 'Sign In'}
        </Button>
    );
}

export function LoginForm() {
    const [state, formAction] = useActionState(loginAction, undefined);

    return (
        <form action={formAction} className="space-y-4">
            <div>
                <Label htmlFor="email" className="text-sm text-ink-700 mb-1.5">
                    Email
                </Label>
                <Input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <div>
                <Label htmlFor="password" className="text-sm text-ink-700 mb-1.5">
                    Password
                </Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {state?.error && <p className="text-sm text-error-600">{state.error}</p>}
            <SubmitButton />
        </form>
    );
}
