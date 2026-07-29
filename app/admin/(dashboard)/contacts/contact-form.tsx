'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ContactFormState } from '@/app/admin/actions';

export interface ContactFormValues {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-8">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface ContactFormProps {
    action: (prevState: ContactFormState | undefined, formData: FormData) => Promise<ContactFormState>;
    defaultValues?: Partial<ContactFormValues>;
    submitLabel: string;
}

export function ContactForm({ action, defaultValues, submitLabel }: ContactFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="space-y-6 max-w-2xl">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                        First Name
                    </label>
                    <Input id="firstName" name="firstName" required defaultValue={defaultValues?.firstName} />
                </div>
                <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Last Name
                    </label>
                    <Input id="lastName" name="lastName" required defaultValue={defaultValues?.lastName} />
                </div>
            </div>

            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                </label>
                <Input id="email" name="email" type="email" required defaultValue={defaultValues?.email} />
            </div>

            <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone
                </label>
                <Input id="phone" name="phone" required defaultValue={defaultValues?.phone} />
            </div>

            <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Message
                </label>
                <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    defaultValue={defaultValues?.message}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Link href="/admin/contacts">
                    <Button type="button" variant="outline" className="rounded-full">
                        Cancel
                    </Button>
                </Link>
            </div>
        </form>
    );
}
