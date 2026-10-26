'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Autocomplete } from '@/components/ui/autocomplete';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { PlanFormState } from '@/app/admin/actions';

export interface PlanFormValues {
    id?: string;
    product: string;
    name: string;
    slug: string;
    tagline: string;
    priceUnit: 'PER_USER_MONTHLY' | 'FLAT_MONTHLY';
    priceAmount: string;
    transactionFeePercent: string;
    paddlePriceId: string;
    currencyId: string;
    userLimit: string;
    vcpu: string;
    ramMb: string;
    storageGb: string;
    trialDays: string;
    features: string;
    metadata: string;
    isActive: boolean;
    sortOrder: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

interface PlanFormProps {
    /** Options for the product select, from the Product table. */
    products: { id: string; label: string }[];
    /** Enabled currencies, from the Currency table. */
    currencies: { id: string; code: string; name: string; symbol: string; numberFormat: string }[];
    action: (prevState: PlanFormState | undefined, formData: FormData) => Promise<PlanFormState>;
    defaultValues?: Partial<PlanFormValues>;
    submitLabel: string;
}

export function PlanForm({ action, defaultValues, submitLabel, products, currencies }: PlanFormProps) {
    const [state, formAction] = useActionState(action, undefined);
    const [currencyId, setCurrencyId] = useState(defaultValues?.currencyId ?? '');
    const selectedCurrency = currencies.find((c) => c.id === currencyId);

    return (
        <form action={formAction} className="portal-stack portal-form">
            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="product" className="portal-text-body text-foreground/80 mb-1.5">Product</Label>
                    <Select name="product" defaultValue={defaultValues?.product ?? products[0]?.id}>
                        <SelectTrigger id="product" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>{product.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="name" className="portal-text-body text-foreground/80 mb-1.5">Plan name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="Growth" />
                </div>
            </div>

            <div>
                <Label htmlFor="slug" className="portal-text-body text-foreground/80 mb-1.5">
                    Slug <span className="text-muted-foreground font-normal">(optional — auto-generated from name if left blank)</span>
                </Label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <Label htmlFor="tagline" className="portal-text-body text-foreground/80 mb-1.5">
                    Tagline <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="tagline" name="tagline" defaultValue={defaultValues?.tagline} placeholder="Growing SMBs, multi-department" />
            </div>

            <div className="grid md:grid-cols-3 gap-gap-lg">
                <div>
                    <Label htmlFor="priceUnit" className="portal-text-body text-foreground/80 mb-1.5">Price unit</Label>
                    <Select name="priceUnit" defaultValue={defaultValues?.priceUnit ?? 'FLAT_MONTHLY'}>
                        <SelectTrigger id="priceUnit" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PER_USER_MONTHLY">Per user / month</SelectItem>
                            <SelectItem value="FLAT_MONTHLY">Flat / month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="currencyId" className="portal-text-body text-foreground/80 mb-1.5">Currency</Label>
                    <Autocomplete
                        id="currencyId"
                        name="currencyId"
                        value={currencyId}
                        onValueChange={setCurrencyId}
                        placeholder="Select a currency"
                        searchPlaceholder="Search currencies…"
                        emptyMessage="No currency matches that."
                        options={currencies.map((c) => ({
                            value: c.id,
                            label: `${c.code} — ${c.name}`,
                            icon: <span className="w-8 shrink-0 text-center font-semibold">{c.symbol}</span>,
                            keywords: [c.symbol, c.name],
                        }))}
                    />
                </div>
                <div>
                    <Label htmlFor="priceAmount" className="portal-text-body text-foreground/80 mb-1.5">
                        Price <span className="text-muted-foreground font-normal">(blank = custom quote)</span>
                    </Label>
                    <SmartInput
                        id="priceAmount"
                        name="priceAmount"
                        kind="currency"
                        min={0}
                        defaultValue={defaultValues?.priceAmount}
                        placeholder="49"
                        numberFormat={selectedCurrency?.numberFormat}
                        symbol={selectedCurrency?.symbol}
                    />
                </div>
                <div>
                    <Label htmlFor="transactionFeePercent" className="portal-text-body text-foreground/80 mb-1.5">
                        Transaction fee % <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <SmartInput id="transactionFeePercent" name="transactionFeePercent" kind="percent" decimals={1} min={0} max={100} defaultValue={defaultValues?.transactionFeePercent} placeholder="2" />
                </div>
            </div>

            <div>
                <Label htmlFor="paddlePriceId" className="portal-text-body text-foreground/80 mb-1.5">
                    Paddle price ID <span className="text-muted-foreground font-normal">(blank = not sold online)</span>
                </Label>
                <Input id="paddlePriceId" name="paddlePriceId" defaultValue={defaultValues?.paddlePriceId} placeholder="pri_01h..." />
                <p className="mt-1.5 portal-text-caption text-muted-foreground">
                    From Paddle &gt; Catalog &gt; Products. Customers cannot check out on this plan until it is set.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-gap-lg">
                <div>
                    <Label htmlFor="userLimit" className="portal-text-body text-foreground/80 mb-1.5">
                        Seat limit <span className="text-muted-foreground font-normal">(blank = unlimited)</span>
                    </Label>
                    <SmartInput id="userLimit" name="userLimit" kind="integer" min={0} defaultValue={defaultValues?.userLimit} placeholder="25" />
                </div>
                <div>
                    <Label htmlFor="sortOrder" className="portal-text-body text-foreground/80 mb-1.5">Display order</Label>
                    <SmartInput id="sortOrder" name="sortOrder" kind="integer" defaultValue={defaultValues?.sortOrder ?? '0'} />
                </div>
            </div>

            <fieldset className="rounded-xl border border-border/60 bg-muted/50 p-card">
                <legend className="px-2 portal-text-body font-semibold text-foreground">Site resources</legend>
                <p className="portal-text-caption text-muted-foreground">
                    What each Frappe site on this plan is given. CPU and RAM are hard limits on its containers;
                    storage is measured and the customer is warned when it is exceeded. Blank uses the platform default.
                </p>
                <div className="mt-4 grid md:grid-cols-3 gap-gap-lg">
                    <div>
                        <Label htmlFor="vcpu" className="portal-text-body text-foreground/80 mb-1.5">vCPU</Label>
                        <SmartInput id="vcpu" name="vcpu" kind="decimal" decimals={2} min={0.25} max={64} defaultValue={defaultValues?.vcpu} placeholder="2" />
                    </div>
                    <div>
                        <Label htmlFor="ramMb" className="portal-text-body text-foreground/80 mb-1.5">RAM (MB)</Label>
                        <SmartInput id="ramMb" name="ramMb" kind="integer" min={768} max={262144} defaultValue={defaultValues?.ramMb} placeholder="4096" />
                    </div>
                    <div>
                        <Label htmlFor="storageGb" className="portal-text-body text-foreground/80 mb-1.5">Storage (GB)</Label>
                        <SmartInput id="storageGb" name="storageGb" kind="integer" min={1} max={10000} defaultValue={defaultValues?.storageGb} placeholder="30" />
                    </div>
                </div>
            </fieldset>

            <fieldset className="rounded-xl border border-border/60 bg-muted/50 p-card">
                <legend className="px-2 portal-text-body font-semibold text-foreground">Free trial</legend>
                <p className="portal-text-caption text-muted-foreground">
                    Lets a customer create a site on this plan without paying. Each customer gets one trial per plan. When the
                    trial ends the site is switched off and cannot be used until they subscribe to the plan; if they subscribe before
                    then the site simply carries on. Trial sites cannot buy paid apps.
                </p>
                <div className="mt-4 max-w-xs">
                    <Label htmlFor="trialDays" className="portal-text-body text-foreground/80 mb-1.5">
                        Trial length (days) <span className="text-muted-foreground font-normal">(blank or 0 = no trial)</span>
                    </Label>
                    <SmartInput id="trialDays" name="trialDays" kind="integer" min={0} max={365} defaultValue={defaultValues?.trialDays} placeholder="14" />
                </div>
            </fieldset>

            <div>
                <Label htmlFor="features" className="portal-text-body text-foreground/80 mb-1.5">
                    Features <span className="text-muted-foreground font-normal">(one per line)</span>
                </Label>
                <Textarea id="features" name="features" rows={5} defaultValue={defaultValues?.features} placeholder={'Accounting + HR + Inventory + CRM\nPriority email + chat support'} />
            </div>

            <div>
                <Label htmlFor="metadata" className="portal-text-body text-foreground/80 mb-1.5">
                    Metadata <span className="text-muted-foreground font-normal">(JSON, optional)</span>
                </Label>
                <Textarea
                    id="metadata"
                    name="metadata"
                    rows={7}
                    spellCheck={false}
                    className="font-mono text-sm"
                    defaultValue={defaultValues?.metadata}
                    placeholder={'{\n  "restrictions": {\n    "modules": ["Accounting"],\n    "roles": ["Accounts User"]\n  }\n}'}
                />
                <p className="mt-1.5 portal-text-caption text-muted-foreground">
                    <code>restrictions.modules</code> are the only Frappe modules a new site on this plan shows, and{' '}
                    <code>restrictions.roles</code> are created and given to the customer&apos;s administrator account.
                    Leave them out to change nothing. Other keys are stored as they are.
                </p>
            </div>

            <Label htmlFor="isActive" className="portal-text-body text-foreground/80">
                <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
                Active — visible on the pricing page and available for new subscriptions
            </Label>

            {state?.error && <p className="portal-text-body text-destructive">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/plans">
                        Cancel
                    </Link></Button>
            </div>
        </form>
    );
}
