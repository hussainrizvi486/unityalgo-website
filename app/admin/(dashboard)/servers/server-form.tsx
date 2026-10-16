'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ControllerFormState } from '@/app/admin/controller-actions';

export interface ServerFormValues {
    name: string;
    ip_address: string;
    private_ip: string;
    role: 'worker' | 'proxy';
    ssh_port: string;
    ssh_user: string;
    max_memory_mb: string;
    max_containers: string;
    max_sites: string;
    is_active: boolean;
    frappe_enabled: boolean;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface ServerFormProps {
    action: (prev: ControllerFormState | undefined, formData: FormData) => Promise<ControllerFormState>;
    defaultValues?: Partial<ServerFormValues>;
    submitLabel: string;
    isEdit?: boolean;
}

export function ServerForm({ action, defaultValues, submitLabel, isEdit }: ServerFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="portal-stack portal-form">
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 portal-text-body">
                <Checkbox name="frappe_enabled" defaultChecked={defaultValues?.frappe_enabled ?? false} />
                <span>Allow Frappe site provisioning<span className="mt-1 block portal-text-caption text-muted-foreground">For healthy worker nodes with Docker Compose, at least 6 GB of available memory and ten container slots per site.</span></span>
            </label>
            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="name" className="portal-text-body text-foreground/80 mb-1.5">Node name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="worker-01" />
                </div>
                <div>
                    <Label htmlFor="role" className="portal-text-body text-foreground/80 mb-1.5">Role</Label>
                    <Select name="role" defaultValue={defaultValues?.role ?? 'worker'}>
                        <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="worker">Worker — runs tenant containers</SelectItem>
                            <SelectItem value="proxy">Proxy — runs the Caddy edge</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="ip_address" className="portal-text-body text-foreground/80 mb-1.5">Public IP</Label>
                    <Input id="ip_address" name="ip_address" required defaultValue={defaultValues?.ip_address} placeholder="203.0.113.10" />
                </div>
                <div>
                    <Label htmlFor="private_ip" className="portal-text-body text-foreground/80 mb-1.5">
                        Private IP <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="private_ip" name="private_ip" defaultValue={defaultValues?.private_ip} placeholder="10.0.0.10" />
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-gap-lg">
                <div>
                    <Label htmlFor="ssh_port" className="portal-text-body text-foreground/80 mb-1.5">SSH port</Label>
                    <SmartInput id="ssh_port" name="ssh_port" kind="integer" min={1} max={65535} defaultValue={defaultValues?.ssh_port ?? '22'} />
                </div>
                <div>
                    <Label htmlFor="ssh_user" className="portal-text-body text-foreground/80 mb-1.5">
                        SSH user <span className="text-muted-foreground font-normal">(blank = default)</span>
                    </Label>
                    <Input id="ssh_user" name="ssh_user" defaultValue={defaultValues?.ssh_user} placeholder="ubuntu" />
                </div>
                <div>
                    <Label htmlFor="ssh_password" className="portal-text-body text-foreground/80 mb-1.5">
                        SSH password {isEdit ? <span className="text-muted-foreground font-normal">(blank = unchanged)</span> : <span className="text-muted-foreground font-normal">(or use key)</span>}
                    </Label>
                    <PasswordInput id="ssh_password" name="ssh_password" autoComplete="new-password" />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="max_memory_mb" className="portal-text-body text-foreground/80 mb-1.5">
                        Max memory (MB) <span className="text-muted-foreground font-normal">(blank = detect on connect)</span>
                    </Label>
                    <SmartInput id="max_memory_mb" name="max_memory_mb" kind="integer" min={0} defaultValue={defaultValues?.max_memory_mb} placeholder="8192" />
                </div>
                <div>
                    <Label htmlFor="max_containers" className="portal-text-body text-foreground/80 mb-1.5">
                        Max containers <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <SmartInput id="max_containers" name="max_containers" kind="integer" min={0} defaultValue={defaultValues?.max_containers} placeholder="20" />
                </div>
            </div>

            <div>
                <Label htmlFor="max_sites" className="portal-text-body text-foreground/80 mb-1.5">
                    Maximum sites <span className="text-muted-foreground font-normal">(customer ERP sites; blank = no limit)</span>
                </Label>
                <SmartInput id="max_sites" name="max_sites" kind="integer" min={0} defaultValue={defaultValues?.max_sites} placeholder="10" />
                <p className="mt-1.5 portal-text-caption text-muted-foreground">
                    When every server has reached its limit, customers are told we are at full capacity until room is made.
                    Enter 0 to stop new sites landing here without taking the server out of service.
                </p>
            </div>

            {isEdit ? (
                <Label htmlFor="is_active" className="portal-text-body text-foreground/80">
                    <Checkbox id="is_active" name="is_active" defaultChecked={defaultValues?.is_active ?? true} />
                    Active — eligible for new tenant placements
                </Label>
            ) : null}

            {state?.error && <Notice tone="error">{state.error}</Notice>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/servers">Cancel</Link></Button>
            </div>
        </form>
    );
}
