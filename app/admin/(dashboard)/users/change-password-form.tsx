'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserFormState } from '@/app/admin/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="bg-ink-900 hover:bg-ink-800 text-white px-8">
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
                <Label htmlFor="password" className="text-sm text-ink-700 mb-1.5">
                    New Password
                </Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            <div>
                <Label htmlFor="confirmPassword" className="text-sm text-ink-700 mb-1.5">
                    Confirm New Password
                </Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            {state?.error && <p className="text-sm text-error-600">{state.error}</p>}
            {state?.success && <p className="text-sm text-success-600">Password updated.</p>}

            <SubmitButton />
        </form>
    );
}
