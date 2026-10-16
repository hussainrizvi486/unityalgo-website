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
        <Button type="submit" disabled={pending} className="">
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
        <form action={formAction} className="portal-stack portal-form-narrow">
            <div>
                <Label htmlFor="password" className="portal-text-body text-foreground/80 mb-1.5">
                    New Password
                </Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            <div>
                <Label htmlFor="confirmPassword" className="portal-text-body text-foreground/80 mb-1.5">
                    Confirm New Password
                </Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>

            {state?.error && <p className="portal-text-body text-destructive">{state.error}</p>}
            {state?.success && <p className="portal-text-body text-success">Password updated.</p>}

            <SubmitButton />
        </form>
    );
}
