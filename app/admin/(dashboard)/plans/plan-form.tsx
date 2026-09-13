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
    features: string;
    isActive: boolean;
    sortOrder: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="bg-ink-900 hover:bg-ink-800 text-white px-8">
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
    // Held in state so changing the currency reformats the price immediately,
    // rather than only after a save and reload.
    const [currencyId, setCurrencyId] = useState(defaultValues?.currencyId ?? '');
    const selectedCurrency = currencies.find((c) => c.id === currencyId);

    return (
        <form action={formAction} className="space-y-6 max-w-2xl">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="product" className="text-sm text-ink-700 mb-1.5">Product</Label>
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
                    <Label htmlFor="name" className="text-sm text-ink-700 mb-1.5">Plan name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="Growth" />
                </div>
            </div>

            <div>
                <Label htmlFor="slug" className="text-sm text-ink-700 mb-1.5">
                    Slug <span className="text-ink-400 font-normal">(optional — auto-generated from name if left blank)</span>
                </Label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <Label htmlFor="tagline" className="text-sm text-ink-700 mb-1.5">
                    Tagline <span className="text-ink-400 font-normal">(optional)</span>
                </Label>
                <Input id="tagline" name="tagline" defaultValue={defaultValues?.tagline} placeholder="Growing SMBs, multi-department" />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div>
                    <Label htmlFor="priceUnit" className="text-sm text-ink-700 mb-1.5">Price unit</Label>
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
                    <Label htmlFor="currencyId" className="text-sm text-ink-700 mb-1.5">Currency</Label>
                    <Select name="currencyId" value={currencyId} onValueChange={setCurrencyId}>
                        <SelectTrigger id="currencyId"><SelectValue placeholder="Select a currency" /></SelectTrigger>
                        <SelectContent>
                            {currencies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="priceAmount" className="text-sm text-ink-700 mb-1.5">
                        Price <span className="text-ink-400 font-normal">(blank = custom quote)</span>
                    </Label>
                    <SmartInput
                        id="priceAmount"
                        name="priceAmount"
                        kind="currency"
                        min={0}
                        defaultValue={defaultValues?.priceAmount}
                        placeholder="49"
                        // Follows the currency chosen above, so the preview on
                        // blur is the currency the plan will actually charge.
                        numberFormat={selectedCurrency?.numberFormat}
                        symbol={selectedCurrency?.symbol}
                    />
                </div>
                <div>
                    <Label htmlFor="transactionFeePercent" className="text-sm text-ink-700 mb-1.5">
                        Transaction fee % <span className="text-ink-400 font-normal">(optional)</span>
                    </Label>
                    <SmartInput id="transactionFeePercent" name="transactionFeePercent" kind="percent" decimals={1} min={0} max={100} defaultValue={defaultValues?.transactionFeePercent} placeholder="2" />
                </div>
            </div>

            <div>
                <Label htmlFor="paddlePriceId" className="text-sm text-ink-700 mb-1.5">
                    Paddle price ID <span className="text-ink-400 font-normal">(blank = not sold online)</span>
                </Label>
                <Input id="paddlePriceId" name="paddlePriceId" defaultValue={defaultValues?.paddlePriceId} placeholder="pri_01h..." />
                <p className="mt-1.5 text-xs text-ink-500">
                    From Paddle &gt; Catalog &gt; Products. Customers cannot check out on this plan until it is set.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="userLimit" className="text-sm text-ink-700 mb-1.5">
                        Seat limit <span className="text-ink-400 font-normal">(blank = unlimited)</span>
                    </Label>
                    <SmartInput id="userLimit" name="userLimit" kind="integer" min={0} defaultValue={defaultValues?.userLimit} placeholder="25" />
                </div>
                <div>
                    <Label htmlFor="sortOrder" className="text-sm text-ink-700 mb-1.5">Display order</Label>
                    <SmartInput id="sortOrder" name="sortOrder" kind="integer" defaultValue={defaultValues?.sortOrder ?? '0'} />
                </div>
            </div>

            <div>
                <Label htmlFor="features" className="text-sm text-ink-700 mb-1.5">
                    Features <span className="text-ink-400 font-normal">(one per line)</span>
                </Label>
                <Textarea id="features" name="features" rows={5} defaultValue={defaultValues?.features} placeholder={'Accounting + HR + Inventory + CRM\nPriority email + chat support'} />
            </div>

            <Label htmlFor="isActive" className="text-sm text-ink-700">
                <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
                Active — visible on the pricing page and available for new subscriptions
            </Label>

            {state?.error && <p className="text-sm text-error-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Link href="/admin/plans">
                    <Button type="button" variant="outline" >
                        Cancel
                    </Button>
                </Link>
            </div>
        </form>
    );
}
