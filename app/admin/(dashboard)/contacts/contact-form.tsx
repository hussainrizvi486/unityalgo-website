'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
        <Button type="submit" disabled={pending} className="">
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
        <form action={formAction} className="portal-stack portal-form">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="firstName" className="portal-text-body text-ink-700 mb-1.5">
                        First Name
                    </Label>
                    <Input id="firstName" name="firstName" required defaultValue={defaultValues?.firstName} />
                </div>
                <div>
                    <Label htmlFor="lastName" className="portal-text-body text-ink-700 mb-1.5">
                        Last Name
                    </Label>
                    <Input id="lastName" name="lastName" required defaultValue={defaultValues?.lastName} />
                </div>
            </div>

            <div>
                <Label htmlFor="email" className="portal-text-body text-ink-700 mb-1.5">
                    Email
                </Label>
                <Input id="email" name="email" type="email" required defaultValue={defaultValues?.email} />
            </div>

            <div>
                <Label htmlFor="phone" className="portal-text-body text-ink-700 mb-1.5">
                    Phone
                </Label>
                <Input id="phone" name="phone" required defaultValue={defaultValues?.phone} />
            </div>

            <div>
                <Label htmlFor="message" className="portal-text-body text-ink-700 mb-1.5">
                    Message
                </Label>
                <Textarea id="message" name="message" required rows={5} defaultValue={defaultValues?.message} />
            </div>

            {state?.error && <p className="portal-text-body text-error-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/contacts">
                        Cancel
                    </Link></Button>
            </div>
        </form>
    );
}
