'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserFormState } from '@/app/admin/actions';

export interface UserFormValues {
    email: string;
    name: string;
    password?: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface UserFormProps {
    action: (prevState: UserFormState | undefined, formData: FormData) => Promise<UserFormState>;
    defaultValues?: Partial<UserFormValues>;
    submitLabel: string;
    includePassword?: boolean;
}

export function UserForm({ action, defaultValues, submitLabel, includePassword }: UserFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="portal-stack portal-form-narrow">
            <div>
                <Label htmlFor="email" className="portal-text-body text-foreground/80 mb-1.5">
                    Email
                </Label>
                <Input id="email" name="email" type="email" required defaultValue={defaultValues?.email} />
            </div>

            <div>
                <Label htmlFor="name" className="portal-text-body text-foreground/80 mb-1.5">
                    Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="name" name="name" defaultValue={defaultValues?.name} />
            </div>

            {includePassword && (
                <div>
                    <Label htmlFor="password" className="portal-text-body text-foreground/80 mb-1.5">
                        Password
                    </Label>
                    <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </div>
            )}

            {state?.error && <p className="portal-text-body text-destructive">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/users">
                        Cancel
                    </Link></Button>
            </div>
        </form>
    );
}
