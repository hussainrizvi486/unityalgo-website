'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { updateCustomerPasswordAction, type AccountFormState } from '@/app/customer/actions';


function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 bg-ink-900 px-7 text-white hover:bg-ink-800">
      {pending ? 'Updating…' : 'Update password'}
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<AccountFormState | undefined, FormData>(updateCustomerPasswordAction, undefined);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/settings" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to settings
      </Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Settings</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Change password</h1>
      <p className="mt-2 text-sm text-ink-500">Update the password used to sign in to your account.</p>

      <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3"><KeyRound className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Password</h2></div>
        <form action={formAction} className="space-y-5">
          <div>
            <Label htmlFor="currentPassword" className="mb-1.5 text-sm text-ink-700">Current password</Label>
            <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="newPassword" className="mb-1.5 text-sm text-ink-700">New password</Label>
            <PasswordInput id="newPassword" name="newPassword" required autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirmNewPassword" className="mb-1.5 text-sm text-ink-700">Confirm password</Label>
            <PasswordInput id="confirmNewPassword" name="confirmNewPassword" required autoComplete="new-password" />
          </div>
          {state?.error ? <Notice tone="error">{state.error}</Notice> : null}
          {state?.success ? <Notice tone="success">{state.success}</Notice> : null}
          <SubmitButton />
        </form>
      </section>
    </div>
  );
}
