'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { createTenantAction } from '@/app/admin/controller-actions';
import type { SubscriptionOption } from '@/lib/tenant-accounts';

/** Sentinel for "no subscription", which reveals the manual email field. */
const NO_SUBSCRIPTION = 'none';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="bg-ink-900 hover:bg-ink-800 text-white px-8">
            {pending ? 'Creating...' : 'Create Tenant'}
        </Button>
    );
}

export interface ClusterOption {
    id: string;
    name: string;
    isDefault: boolean;
}

export function NewTenantForm({
    clusters,
    subscriptions,
}: {
    clusters: ClusterOption[];
    subscriptions: SubscriptionOption[];
}) {
    const [state, formAction] = useActionState(createTenantAction, undefined);
    const fallback = clusters.find((c) => c.isDefault);

    const available = subscriptions.filter((s) => !s.claimedBy);
    const [subscriptionId, setSubscriptionId] = useState<string>(
        available.length > 0 ? available[0].id : NO_SUBSCRIPTION,
    );
    const selected = subscriptions.find((s) => s.id === subscriptionId) ?? null;

    return (
        <form action={formAction} className="space-y-6 max-w-2xl">
            <div>
                <Label htmlFor="tenant_slug" className="text-sm text-ink-700 mb-1.5">Tenant slug</Label>
                <Input id="tenant_slug" name="tenant_slug" required placeholder="north-and-co" />
                <p className="mt-1 text-xs text-ink-400">Becomes the platform subdomain. Lowercase, hyphens only.</p>
            </div>

            <div>
                <Label htmlFor="subscription_id" className="text-sm text-ink-700 mb-1.5">Subscription</Label>
                <Select name="subscription_id" value={subscriptionId} onValueChange={setSubscriptionId}>
                    <SelectTrigger id="subscription_id" className="w-full">
                        <SelectValue placeholder="Choose the subscription paying for this store" />
                    </SelectTrigger>
                    <SelectContent>
                        {subscriptions.map((s) => (
                            <SelectItem key={s.id} value={s.id} disabled={Boolean(s.claimedBy)}>
                                {s.customerName} — {s.planName}
                                {s.storeName ? ` · ${s.storeName}` : ''}
                                {s.claimedBy ? ` (already used by ${s.claimedBy})` : ''}
                            </SelectItem>
                        ))}
                        <SelectItem value={NO_SUBSCRIPTION}>No subscription — enter an email</SelectItem>
                    </SelectContent>
                </Select>
                {selected ? (
                    <p className="mt-1.5 text-xs text-ink-500">
                        Customer <span className="font-medium text-ink-700">{selected.customerEmail}</span> ·
                        plan <span className="font-medium text-ink-700">{selected.planName}</span> ·
                        subscription {selected.status.toLowerCase()}. Both are taken from the subscription.
                    </p>
                ) : (
                    <p className="mt-1.5 text-xs text-ink-400">
                        The store will not be linked to a plan or a customer account. You can attach a
                        subscription later from the tenant page.
                    </p>
                )}
                {subscriptions.length === 0 && (
                    <p className="mt-1.5 text-xs text-ink-400">
                        No UnityCommerce subscriptions yet — create one from the customer&apos;s page first.
                    </p>
                )}
            </div>

            {!selected && (
                <div>
                    <Label htmlFor="customer_email" className="text-sm text-ink-700 mb-1.5">Customer email</Label>
                    <Input id="customer_email" name="customer_email" type="email" required placeholder="owner@example.com" />
                </div>
            )}

            <div>
                <Label htmlFor="database_connection_id" className="text-sm text-ink-700 mb-1.5">
                    Database cluster
                </Label>
                {clusters.length === 0 ? (
                    <p className="text-sm text-ink-500">
                        No clusters registered — the tenant&apos;s database will be created on the controller&apos;s
                        own PostgreSQL.
                    </p>
                ) : (
                    <>
                        <Select name="database_connection_id" defaultValue={fallback?.id ?? ''}>
                            <SelectTrigger id="database_connection_id" className="w-full">
                                <SelectValue placeholder="Use the default cluster" />
                            </SelectTrigger>
                            <SelectContent>
                                {clusters.map((cluster) => (
                                    <SelectItem key={cluster.id} value={cluster.id}>
                                        {cluster.name}{cluster.isDefault ? ' (default)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-ink-400">
                            Where this tenant&apos;s data lives. It can be moved later, but that copies the database.
                        </p>
                    </>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div>
                    <Label htmlFor="plan_tier" className="text-sm text-ink-700 mb-1.5">Plan</Label>
                    {selected ? (
                        // Derived, not entered: the plan is whatever the chosen
                        // subscription is on, and the server overwrites this field
                        // regardless of what is posted.
                        <div className="flex h-10 items-center rounded-md border border-ink-200 bg-ink-50 px-3 text-sm text-ink-600">
                            {selected.planName}
                            <span className="ml-1.5 text-xs text-ink-400">({selected.planSlug})</span>
                        </div>
                    ) : (
                        <Input id="plan_tier" name="plan_tier" defaultValue="launch" />
                    )}
                </div>
                <div>
                    <Label htmlFor="memory_limit_mb" className="text-sm text-ink-700 mb-1.5">
                        Memory (MB) <span className="text-ink-400 font-normal">(blank = default)</span>
                    </Label>
                    <SmartInput id="memory_limit_mb" name="memory_limit_mb" kind="integer" min={64} placeholder="256" />
                </div>
                <div>
                    <Label htmlFor="cpu_limit_cores" className="text-sm text-ink-700 mb-1.5">
                        CPU cores <span className="text-ink-400 font-normal">(blank = default)</span>
                    </Label>
                    <Input id="cpu_limit_cores" name="cpu_limit_cores" placeholder="0.50" />
                </div>
            </div>

            {state?.error && <Notice tone="error">{state.error}</Notice>}

            <div className="flex items-center gap-3">
                <SubmitButton />
                <Link href="/admin/tenants">
                    <Button type="button" variant="outline" >Cancel</Button>
                </Link>
            </div>
        </form>
    );
}
