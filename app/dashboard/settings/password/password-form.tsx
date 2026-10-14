'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { PortalPanel } from '@/components/customer/portal-panel';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
    updateCustomerPasswordAction,
    type AccountFormState,
} from '@/app/customer/actions';

export function PasswordForm({ embedded = false }: { embedded?: boolean }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [confirmationTouched, setConfirmationTouched] = useState(false);
    const [clientError, setClientError] = useState('');
    const [edited, setEdited] = useState(false);
    const [state, formAction, pending] = useActionState<
        AccountFormState | undefined,
        FormData
    >(async (previous, data) => {
        const result = await updateCustomerPasswordAction(previous, data);
        setEdited(false);
        if (result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmation('');
            setConfirmationTouched(false);
        }
        return result;
    }, undefined);
    const mismatch =
        confirmationTouched &&
        confirmation.length > 0 &&
        confirmation !== newPassword;
    const matches = confirmation.length > 0 && confirmation === newPassword;

    function markEdited() {
        setEdited(true);
        setClientError('');
    }

    return (
        <div className="mx-auto portal-page">
            {!embedded && (
                <>
                    <Link
                        href="/dashboard/settings?tab=security"
                        className="mb-6 inline-flex items-center gap-2 portal-text-body font-medium text-ink-500 hover:text-ink-900"
                    >
                        <ArrowLeft className="size-4" />
                        Back to settings
                    </Link>
                    <p className="portal-text-caption font-semibold uppercase tracking-wider text-ink-500">
                        Account security
                    </p>
                    <h1 className="portal-page-title mt-2">
                        Change password
                    </h1>
                    <p className="mt-3 portal-text-body text-ink-600">
                        Keep your account protected with a password only you
                        know.
                    </p>
                </>
            )}
            <PortalPanel
                padding="none"
                className={`${embedded ? '' : 'mt-8 '}overflow-hidden`}
                aria-labelledby="password-heading"
            >
                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <div className="border-b border-ink-200 p-5 sm:p-7 lg:border-r lg:border-b-0">
                        <span className="mb-5 inline-flex size-10 items-center justify-center rounded-lg border border-ink-200 bg-ink-50">
                            <KeyRound
                                className="size-5 text-ink-700"
                                aria-hidden="true"
                            />
                        </span>
                        <h2
                            id="password-heading"
                            className="text-xl font-semibold tracking-tight text-ink-950"
                        >
                            Change your password
                        </h2>
                        <p className="mt-3 max-w-sm portal-text-body leading-6 text-ink-600">
                            Enter your current password, then choose a new one
                            for your UnityAlgo account.
                        </p>
                        <div className="mt-7 rounded-lg bg-ink-50 p-4">
                            <h3 className="portal-text-body font-semibold text-ink-900">
                                Choose a memorable passphrase
                            </h3>
                            <p className="mt-2 portal-text-body leading-6 text-ink-600">
                                Use at least 8 characters. A longer phrase with
                                several unrelated words is easier to remember.
                                Avoid reusing a password from another account.
                            </p>
                        </div>
                        <div className="mt-6 flex items-start gap-3 portal-text-body leading-6 text-ink-600">
                            <ShieldCheck
                                className="mt-1 size-4 shrink-0 text-ink-500"
                                aria-hidden="true"
                            />
                            <p>
                                Your other devices will be signed out after this
                                change. You will stay signed in on this device.
                            </p>
                        </div>
                    </div>
                    <form
                        action={formAction}
                        className="p-5 sm:p-7"
                        aria-busy={pending}
                        onSubmit={(event) => {
                            if (
                                newPassword !== confirmation ||
                                newPassword === currentPassword
                            ) {
                                event.preventDefault();
                                setConfirmationTouched(true);
                                setClientError(
                                    newPassword === currentPassword
                                        ? 'Choose a password different from your current password.'
                                        : 'Your new passwords do not match. Please check them and try again.',
                                );
                            }
                        }}
                    >
                        <fieldset disabled={pending} className="portal-stack">
                            <div>
                                <Label
                                    htmlFor="currentPassword"
                                    className="text-ink-700"
                                >
                                    Current password
                                </Label>
                                <PasswordInput
                                    id="currentPassword"
                                    name="currentPassword"

                                    required
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(event) => {
                                        setCurrentPassword(event.target.value);
                                        markEdited();
                                    }}
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="newPassword"
                                    className="text-ink-700"
                                >
                                    New password
                                </Label>
                                <PasswordInput
                                    id="newPassword"
                                    name="newPassword"

                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    aria-describedby="password-requirement"
                                    value={newPassword}
                                    onChange={(event) => {
                                        setNewPassword(event.target.value);
                                        markEdited();
                                    }}
                                />
                                <p
                                    id="password-requirement"
                                    className={`mt-2 flex items-center gap-1.5 portal-text-caption ${newPassword.length >= 8 ? 'text-success-700' : 'text-ink-500'}`}
                                >
                                    {newPassword.length >= 8 && (
                                        <Check
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                    At least 8 characters
                                </p>
                            </div>
                            <div>
                                <Label
                                    htmlFor="confirmNewPassword"
                                    className="text-ink-700"
                                >
                                    Confirm new password
                                </Label>
                                <PasswordInput
                                    id="confirmNewPassword"
                                    name="confirmNewPassword"

                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    aria-invalid={mismatch || undefined}
                                    aria-describedby="password-confirmation"
                                    value={confirmation}
                                    onBlur={() => setConfirmationTouched(true)}
                                    onChange={(event) => {
                                        setConfirmation(event.target.value);
                                        markEdited();
                                    }}
                                />
                                <p
                                    id="password-confirmation"
                                    aria-live="polite"
                                    className={`mt-2 flex min-h-4 items-center gap-1.5 portal-text-caption ${mismatch ? 'text-error-700' : matches ? 'text-success-700' : 'text-ink-500'}`}
                                >
                                    {matches && (
                                        <Check
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {mismatch
                                        ? 'Passwords do not match.'
                                        : matches
                                          ? 'Passwords match.'
                                          : 'Enter your new password again.'}
                                </p>
                            </div>
                            {clientError && (
                                <Notice tone="error">{clientError}</Notice>
                            )}
                            {!edited && state?.error && (
                                <Notice tone="error">{state.error}</Notice>
                            )}
                            {!edited && state?.success && (
                                <Notice tone="success">{state.success}</Notice>
                            )}
                            <div className="border-t border-ink-200 pt-4">
                                <Button
                                    type="submit"
                                    disabled={pending}
                                    className="w-full sm:w-auto"
                                >
                                    {pending && (
                                        <Loader2
                                            className="size-4 animate-spin"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {pending
                                        ? 'Updating password…'
                                        : 'Update password'}
                                </Button>
                            </div>
                        </fieldset>
                    </form>
                </div>
            </PortalPanel>
        </div>
    );
}
