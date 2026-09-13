'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ControllerFormState } from '@/app/admin/controller-actions';

export interface DatabaseFormValues {
    name: string;
    host: string;
    port: string;
    database_name: string;
    username: string;
    sslmode: string;
    role: 'cluster' | 'external';
    host_from_worker: string;
    is_default: boolean;
    allow_writes: boolean;
    notes: string;
}

const SSL_MODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="bg-ink-900 hover:bg-ink-800 text-white px-8">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface DatabaseFormProps {
    action: (prev: ControllerFormState | undefined, formData: FormData) => Promise<ControllerFormState>;
    defaultValues?: Partial<DatabaseFormValues>;
    submitLabel: string;
    isEdit?: boolean;
}

export function DatabaseForm({ action, defaultValues, submitLabel, isEdit }: DatabaseFormProps) {
    const [state, formAction] = useActionState(action, undefined);
    // The cluster-only fields are meaningless for an external connection, so
    // they're revealed rather than shown greyed out.
    const [role, setRole] = useState<string>(defaultValues?.role ?? 'external');

    return (
        <form action={formAction} className="space-y-6 max-w-2xl">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="name" className="text-sm text-ink-700 mb-1.5">Name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="primary-eu" />
                </div>
                <div>
                    <Label htmlFor="role" className="text-sm text-ink-700 mb-1.5">Role</Label>
                    <Select name="role" defaultValue={role} onValueChange={setRole}>
                        <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cluster">Cluster — tenants can be hosted here</SelectItem>
                            <SelectItem value="external">External — query console only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <Label htmlFor="host" className="text-sm text-ink-700 mb-1.5">Host</Label>
                    <Input id="host" name="host" required defaultValue={defaultValues?.host} placeholder="db.example.com" />
                </div>
                <div>
                    <Label htmlFor="port" className="text-sm text-ink-700 mb-1.5">Port</Label>
                    <SmartInput id="port" name="port" kind="integer" min={1} max={65535} defaultValue={defaultValues?.port ?? '5432'} />
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div>
                    <Label htmlFor="database_name" className="text-sm text-ink-700 mb-1.5">
                        {role === 'cluster' ? 'Maintenance database' : 'Database'}
                    </Label>
                    <Input id="database_name" name="database_name" required defaultValue={defaultValues?.database_name} placeholder="postgres" />
                    {role === 'cluster' && (
                        <p className="mt-1 text-xs text-ink-400">Connected to in order to CREATE DATABASE. Usually <code>postgres</code>.</p>
                    )}
                </div>
                <div>
                    <Label htmlFor="username" className="text-sm text-ink-700 mb-1.5">Username</Label>
                    <Input id="username" name="username" required defaultValue={defaultValues?.username} />
                </div>
                <div>
                    <Label htmlFor="password" className="text-sm text-ink-700 mb-1.5">
                        Password {isEdit && <span className="text-ink-400 font-normal">(blank = unchanged)</span>}
                    </Label>
                    <PasswordInput id="password" name="password" autoComplete="new-password" required={!isEdit} />
                </div>
            </div>

            <div>
                <Label htmlFor="sslmode" className="text-sm text-ink-700 mb-1.5">SSL mode</Label>
                <Select name="sslmode" defaultValue={defaultValues?.sslmode ?? 'prefer'}>
                    <SelectTrigger id="sslmode" className="w-full md:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {SSL_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                    </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-ink-400">Managed Postgres usually requires <code>require</code>.</p>
            </div>

            {role === 'cluster' && (
                <div className="space-y-6 rounded-xl border border-ink-100 bg-ink-50/50 p-5">
                    <div>
                        <Label htmlFor="host_from_worker" className="text-sm text-ink-700 mb-1.5">
                            Host as seen from workers <span className="text-ink-400 font-normal">(optional)</span>
                        </Label>
                        <Input id="host_from_worker" name="host_from_worker" defaultValue={defaultValues?.host_from_worker} placeholder="10.0.0.5 or db.internal" />
                        <p className="mt-1 text-xs text-ink-400">
                            Tenant containers run on remote nodes and often cannot reach this database by the same host
                            the controller uses. Leave blank if the address above works from a worker.
                        </p>
                    </div>

                    <Label htmlFor="is_default" className="text-sm text-ink-700">
                        <Checkbox id="is_default" name="is_default" defaultChecked={defaultValues?.is_default} />
                        Default cluster — new tenants are provisioned here
                    </Label>
                </div>
            )}

            <div className="rounded-md border border-warning-500/30 bg-warning-50/50 p-4">
                <Label htmlFor="allow_writes" className="text-sm text-ink-800">
                    <Checkbox id="allow_writes" name="allow_writes" defaultChecked={defaultValues?.allow_writes} />
                    Allow the query console to modify data
                </Label>
                <p className="mt-1.5 pl-6 text-xs text-ink-600">
                    Off by default. While off, statements run inside a read-only transaction and the
                    database itself refuses any INSERT, UPDATE, DELETE or DDL — including ones hidden
                    in a CTE. Turn this on only for a connection you intend to change data through.
                </p>
            </div>

            <div>
                <Label htmlFor="notes" className="text-sm text-ink-700 mb-1.5">
                    Notes <span className="text-ink-400 font-normal">(optional)</span>
                </Label>
                <Textarea id="notes" name="notes" rows={2} defaultValue={defaultValues?.notes} />
            </div>

            {state?.error && <Notice tone="error">{state.error}</Notice>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Link href="/admin/databases">
                    <Button type="button" variant="outline" >Cancel</Button>
                </Link>
            </div>
        </form>
    );
}
