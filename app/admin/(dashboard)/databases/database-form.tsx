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
    engine: 'postgres' | 'mariadb';
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
        <Button type="submit" disabled={pending} className="">
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
    // PostgreSQL hosts UnityCommerce tenants; MariaDB hosts Frappe sites.
    const [engine, setEngine] = useState<string>(defaultValues?.engine ?? 'postgres');
    const mariadb = engine === 'mariadb';

    return (
        <form action={formAction} className="portal-stack portal-form">
            <div className="md:w-1/2">
                <Label htmlFor="engine" className="portal-text-body text-foreground/80 mb-1.5">Engine</Label>
                <Select name="engine" defaultValue={engine} onValueChange={setEngine} disabled={isEdit}>
                    <SelectTrigger id="engine" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="postgres">PostgreSQL — UnityCommerce tenants</SelectItem>
                        <SelectItem value="mariadb">MariaDB — Frappe / ERP sites</SelectItem>
                    </SelectContent>
                </Select>
                {isEdit && <input type="hidden" name="engine" value={engine} />}
            </div>

            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="name" className="portal-text-body text-foreground/80 mb-1.5">Name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="primary-eu" />
                </div>
                <div>
                    <Label htmlFor="role" className="portal-text-body text-foreground/80 mb-1.5">Role</Label>
                    <Select name="role" defaultValue={role} onValueChange={setRole}>
                        <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cluster">Cluster — tenants can be hosted here</SelectItem>
                            <SelectItem value="external">External — query console only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-gap-lg">
                <div className="md:col-span-2">
                    <Label htmlFor="host" className="portal-text-body text-foreground/80 mb-1.5">Host</Label>
                    <Input id="host" name="host" required defaultValue={defaultValues?.host} placeholder="db.example.com" />
                </div>
                <div>
                    <Label htmlFor="port" className="portal-text-body text-foreground/80 mb-1.5">Port</Label>
                    <SmartInput key={engine} id="port" name="port" kind="integer" min={1} max={65535} defaultValue={defaultValues?.port ?? (mariadb ? '3306' : '5432')} />
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-gap-lg">
                <div>
                    <Label htmlFor="database_name" className="portal-text-body text-foreground/80 mb-1.5">
                        {role === 'cluster' ? 'Maintenance database' : 'Database'}
                    </Label>
                    <Input key={engine} id="database_name" name="database_name" required defaultValue={defaultValues?.database_name ?? (mariadb ? 'mysql' : '')} placeholder={mariadb ? 'mysql' : 'postgres'} />
                    {role === 'cluster' && (
                        <p className="mt-1 portal-text-caption text-muted-foreground">
                            {mariadb
                                ? <>Frappe creates one database and user per site. The account needs <code>ALL PRIVILEGES … WITH GRANT OPTION</code>.</>
                                : <>Connected to in order to CREATE DATABASE. Usually <code>postgres</code>.</>}
                        </p>
                    )}
                </div>
                <div>
                    <Label htmlFor="username" className="portal-text-body text-foreground/80 mb-1.5">Username</Label>
                    <Input id="username" name="username" required defaultValue={defaultValues?.username} />
                </div>
                <div>
                    <Label htmlFor="password" className="portal-text-body text-foreground/80 mb-1.5">
                        Password {isEdit && <span className="text-muted-foreground font-normal">(blank = unchanged)</span>}
                    </Label>
                    <PasswordInput id="password" name="password" autoComplete="new-password" required={!isEdit} />
                </div>
            </div>

            <div>
                <Label htmlFor="sslmode" className="portal-text-body text-foreground/80 mb-1.5">SSL mode</Label>
                <Select key={engine} name="sslmode" defaultValue={defaultValues?.sslmode ?? (mariadb ? 'disable' : 'prefer')}>
                    <SelectTrigger id="sslmode" className="w-full md:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {(mariadb ? ['disable', 'require'] : SSL_MODES).map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                    </SelectContent>
                </Select>
                <p className="mt-1 portal-text-caption text-muted-foreground">
                    {mariadb ? <>Use <code>disable</code> for a local MariaDB without TLS.</> : <>Managed Postgres usually requires <code>require</code>.</>}
                </p>
            </div>

            {role === 'cluster' && (
                <div className="portal-stack rounded-xl border border-border/60 bg-muted/50 p-card">
                    <div>
                        <Label htmlFor="host_from_worker" className="portal-text-body text-foreground/80 mb-1.5">
                            Host as seen from workers <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input id="host_from_worker" name="host_from_worker" defaultValue={defaultValues?.host_from_worker} placeholder="10.0.0.5 or db.internal" />
                        <p className="mt-1 portal-text-caption text-muted-foreground">
                            Tenant containers run on remote nodes and often cannot reach this database by the same host
                            the controller uses. Leave blank if the address above works from a worker.
                        </p>
                    </div>

                    <Label htmlFor="is_default" className="portal-text-body text-foreground/80">
                        <Checkbox id="is_default" name="is_default" defaultChecked={defaultValues?.is_default} />
                        Default cluster — new tenants / sites are provisioned here
                    </Label>
                </div>
            )}

            {!mariadb && <div className="rounded-md border border-warning/30 bg-warning/25 p-4">
                <Label htmlFor="allow_writes" className="portal-text-body text-foreground">
                    <Checkbox id="allow_writes" name="allow_writes" defaultChecked={defaultValues?.allow_writes} />
                    Allow the query console to modify data
                </Label>
                <p className="mt-1.5 pl-6 portal-text-caption text-foreground/70">
                    Off by default. While off, statements run inside a read-only transaction and the
                    database itself refuses any INSERT, UPDATE, DELETE or DDL — including ones hidden
                    in a CTE. Turn this on only for a connection you intend to change data through.
                </p>
            </div>}

            <div>
                <Label htmlFor="notes" className="portal-text-body text-foreground/80 mb-1.5">
                    Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea id="notes" name="notes" rows={2} defaultValue={defaultValues?.notes} />
            </div>

            {state?.error && <Notice tone="error">{state.error}</Notice>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/databases">Cancel</Link></Button>
            </div>
        </form>
    );
}
