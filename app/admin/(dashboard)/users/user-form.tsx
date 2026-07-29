'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserFormState } from '@/app/admin/actions';

export interface UserFormValues {
    email: string;
    name: string;
    password?: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8">
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
        <form action={formAction} className="space-y-6 max-w-lg">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                </label>
                <Input id="email" name="email" type="email" required defaultValue={defaultValues?.email} />
            </div>

            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input id="name" name="name" defaultValue={defaultValues?.name} />
            </div>

            {includePassword && (
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password
                    </label>
                    <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </div>
            )}

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Link href="/admin/users">
                    <Button type="button" variant="outline" className="rounded-full">
                        Cancel
                    </Button>
                </Link>
            </div>
        </form>
    );
}
