'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createSiteAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Notice } from '@/components/ui/notice';
function Submit({ available }: { available: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={!available || pending} className="py-2 px-4">
            {pending ? 'Requesting your site…' : 'Create site'}
        </Button>
    );
}
export function SiteForm({
    requestKey,
    apps,
    available,
    selectedApp,
}: {
    requestKey: string;
    apps: { id: string; name: string; available: boolean }[];
    available: boolean;
    selectedApp?: string;
}) {
    const [state, action] = useActionState(createSiteAction, undefined);
    return (
        <form
            action={action}
            className="mt-8 space-y-6 rounded-xl border border-ink-200 bg-white p-6"
        >
            <input type="hidden" name="requestKey" value={requestKey} />
            <div>
                <Label htmlFor="name">Site name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    maxLength={100}
                    placeholder="My business"
                    className="mt-2"
                />
            </div>
            <div>
                <Label htmlFor="slug">Site address</Label>
                <Input
                    id="slug"
                    name="slug"
                    required
                    minLength={3}
                    maxLength={48}
                    pattern="[a-z][a-z0-9-]{1,46}[a-z0-9]"
                    placeholder="my-business"
                    className="mt-2"
                />
                <p className="mt-2 text-xs leading-6 text-ink-500">
                    Use 3–48 lowercase letters, numbers and internal hyphens,
                    starting with a letter. Your site gets its own address.
                </p>
            </div>
            <div>
                <Label htmlFor="adminPassword">
                    Frappe administrator password
                </Label>
                <PasswordInput
                    id="adminPassword"
                    name="adminPassword"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    className="mt-2"
                />
                <p className="mt-2 text-xs text-ink-500">
                    At least 12 characters. Sign in to the site as
                    Administrator.
                </p>
            </div>
            <fieldset>
                <legend className="text-sm font-semibold">Applications</legend>
                <p className="mt-2 text-xs text-ink-500">
                    Frappe and ERPNext are included. Select additional available
                    applications below.
                </p>
                <div className="mt-4 space-y-3">
                    {apps.map((app) => (
                        <label
                            key={app.id}
                            className={`flex items-center justify-between gap-3 rounded-lg border border-ink-200 p-4 text-sm ${app.available ? '' : 'text-ink-500'}`}
                        >
                            <span className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    name="apps"
                                    value={app.id}
                                    disabled={!app.available}
                                    defaultChecked={
                                        app.available && app.id === selectedApp
                                    }
                                    className="size-4 accent-ink-900"
                                />
                                {app.name}
                            </span>
                            {!app.available && (
                                <span className="text-xs">Requires setup</span>
                            )}
                        </label>
                    ))}
                </div>
            </fieldset>
            <div className="border-t border-ink-200 pt-5">
                <p className="mb-5 text-sm leading-6 text-ink-600">
                    Installation runs in the background. You can follow the
                    progress on your site page and in notifications.
                </p>
                {state?.error && (
                    <Notice tone="error" className="mb-4">
                        {state.error}
                    </Notice>
                )}
                <Submit available={available} />
            </div>
        </form>
    );
}
