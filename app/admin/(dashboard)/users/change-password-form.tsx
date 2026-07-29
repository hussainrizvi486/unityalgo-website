'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserFormState } from '@/app/admin/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8">
            {pending ? 'Updating...' : 'Update Password'}
        </Button>
    );
}

interface ChangePasswordFormProps {
    action: (prevState: UserFormState | undefined, formData: FormData) => Promise<UserFormState>;
}

export function ChangePasswordForm({ action }: ChangePasswordFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="space-y-6 max-w-lg">
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    New Password
                </label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm New Password
                </label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state?.success && <p className="text-sm text-green-600">Password updated.</p>}

            <SubmitButton />
        </form>
    );
}
