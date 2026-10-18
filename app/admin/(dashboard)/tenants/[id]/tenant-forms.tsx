'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
    addTenantDomainAction, migrateTenantAction, migrateTenantDatabaseAction, resizeTenantAction,
    type ControllerFormState,
} from '@/app/admin/controller-actions';

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="sm" className="">
            {pending ? pendingLabel : label}
        </Button>
    );
}

function ErrorText({ state }: { state: ControllerFormState | undefined }) {
    if (!state?.error) return null;
    return <Notice tone="error">{state.error}</Notice>;
}

export function TenantResizeForm({ tenantId, memory, cpu }: { tenantId: string; memory: string; cpu: string }) {
    const [state, formAction] = useActionState(resizeTenantAction.bind(null, tenantId), undefined);

    return (
        <form action={formAction} className="space-y-gap">
            <div className="grid grid-cols-2 gap-gap">
                <div>
                    <Label htmlFor="memory_limit_mb" className="mb-1.5 portal-text-body text-foreground/80">Memory (MB)</Label>
                    <SmartInput id="memory_limit_mb" name="memory_limit_mb" kind="integer" min={64} defaultValue={memory} />
                </div>
                <div>
                    <Label htmlFor="cpu_limit_cores" className="mb-1.5 portal-text-body text-foreground/80">CPU cores</Label>
                    <Input id="cpu_limit_cores" name="cpu_limit_cores" defaultValue={cpu} />
                </div>
            </div>
            <ErrorText state={state} />
            <Submit label="Apply resize" pendingLabel="Resizing…" />
        </form>
    );
}

export function TenantMigrateForm({
    tenantId,
    servers,
}: {
    tenantId: string;
    servers: Array<{ id: string; name: string }>;
}) {
    const [state, formAction] = useActionState(migrateTenantAction.bind(null, tenantId), undefined);

    if (servers.length === 0) {
        return <p className="portal-text-body text-muted-foreground">No other active worker nodes available to migrate to.</p>;
    }

    return (
        <form action={formAction} className="space-y-gap">
            <div>
                <Label htmlFor="target_server_id" className="mb-1.5 portal-text-body text-foreground/80">Destination node</Label>
                <Select name="target_server_id">
                    <SelectTrigger id="target_server_id" className="w-full">
                        <SelectValue placeholder="Choose a node" />
                    </SelectTrigger>
                    <SelectContent>
                        {servers.map((server) => (
                            <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ErrorText state={state} />
            <Submit label="Start migration" pendingLabel="Starting…" />
        </form>
    );
}

export function TenantDomainForm({ tenantId }: { tenantId: string }) {
    const [state, formAction] = useActionState(addTenantDomainAction.bind(null, tenantId), undefined);

    return (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
                <Label htmlFor="domain" className="mb-1.5 portal-text-body text-foreground/80">Add a domain</Label>
                <Input id="domain" name="domain" required placeholder="shop.example.com" />
            </div>
            <div>
                <Label htmlFor="domain_type" className="mb-1.5 portal-text-body text-foreground/80">Type</Label>
                <Select name="domain_type" defaultValue="custom">
                    <SelectTrigger id="domain_type" className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="platform">Platform</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Submit label="Add domain" pendingLabel="Adding…" />
            <div className="w-full"><ErrorText state={state} /></div>
        </form>
    );
}

export function TenantDatabaseMigrateForm({
    tenantId,
    clusters,
    currentClusterId,
}: {
    tenantId: string;
    clusters: Array<{ id: string; name: string; isDefault: boolean }>;
    currentClusterId: string | null;
}) {
    const [state, formAction] = useActionState(
        migrateTenantDatabaseAction.bind(null, tenantId),
        undefined,
    );

    const options = clusters.filter((cluster) => cluster.id !== currentClusterId);

    if (options.length === 0) {
        return (
            <p className="portal-text-body text-muted-foreground">
                No other clusters are registered. Add one under Databases to move this tenant.
            </p>
        );
    }

    return (
        <form action={formAction} className="space-y-gap">
            <div>
                <Label htmlFor="target_connection_id" className="mb-1.5 portal-text-body text-foreground/80">
                    Destination cluster
                </Label>
                <Select name="target_connection_id">
                    <SelectTrigger id="target_connection_id" className="w-full">
                        <SelectValue placeholder="Choose a cluster" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                                {cluster.name}{cluster.isDefault ? ' (default)' : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ErrorText state={state} />
            <Submit label="Move database" pendingLabel="Starting…" />
        </form>
    );
}
