'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { connectGithubAction } from '@/app/admin/app-store-actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { PasswordInput } from '@/components/ui/password-input';

function Submit() {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending ? 'Checking with GitHub…' : 'Connect account'}</Button>;
}

export function ConnectForm() {
    const [state, action] = useActionState(connectGithubAction, undefined);
    return (
        <form action={action} className="mt-4 max-w-xl space-y-gap">
            <div>
                <Label htmlFor="github-token">Personal access token</Label>
                <PasswordInput id="github-token" name="token" autoComplete="off" placeholder="github_pat_…" required className="mt-2" />
            </div>
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            {state?.success && <Notice tone="success">{state.success}</Notice>}
            <Submit />
        </form>
    );
}
