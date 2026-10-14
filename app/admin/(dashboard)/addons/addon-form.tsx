'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { AddOnFormState } from '@/app/admin/actions';

export interface AddOnFormValues {
    id?: string;
    product: string;
    name: string;
    slug: string;
    description: string;
    pricingType: 'FLAT_MONTHLY' | 'ONE_TIME';
    priceAmount: string;
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

interface AddOnFormProps {
    /** Options for the product select, from the Product table. */
    products: { id: string; label: string }[];
    action: (prevState: AddOnFormState | undefined, formData: FormData) => Promise<AddOnFormState>;
    defaultValues?: Partial<AddOnFormValues>;
    submitLabel: string;
}

export function AddOnForm({ action, defaultValues, submitLabel, products }: AddOnFormProps) {
    const [state, formAction] = useActionState(action, undefined);

    return (
        <form action={formAction} className="portal-stack portal-form">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="product" className="portal-text-body text-ink-700 mb-1.5">Product</Label>
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
                    <Label htmlFor="name" className="portal-text-body text-ink-700 mb-1.5">Add-on name</Label>
                    <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="Advanced reporting & BI dashboard" />
                </div>
            </div>

            <div>
                <Label htmlFor="slug" className="portal-text-body text-ink-700 mb-1.5">
                    Slug <span className="text-ink-400 font-normal">(optional — auto-generated from name if left blank)</span>
                </Label>
                <Input id="slug" name="slug" defaultValue={defaultValues?.slug} />
            </div>

            <div>
                <Label htmlFor="description" className="portal-text-body text-ink-700 mb-1.5">
                    Description <span className="text-ink-400 font-normal">(optional)</span>
                </Label>
                <Textarea id="description" name="description" rows={2} defaultValue={defaultValues?.description} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div>
                    <Label htmlFor="pricingType" className="portal-text-body text-ink-700 mb-1.5">Pricing type</Label>
                    <Select name="pricingType" defaultValue={defaultValues?.pricingType ?? 'FLAT_MONTHLY'}>
                        <SelectTrigger id="pricingType" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="FLAT_MONTHLY">Flat / month</SelectItem>
                            <SelectItem value="ONE_TIME">One-time fee</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="priceAmount" className="portal-text-body text-ink-700 mb-1.5">
                        Price (USD) <span className="text-ink-400 font-normal">(blank = custom quote)</span>
                    </Label>
                    <SmartInput id="priceAmount" name="priceAmount" kind="decimal" min={0} defaultValue={defaultValues?.priceAmount} placeholder="59" />
                </div>
                <div>
                    <Label htmlFor="sortOrder" className="portal-text-body text-ink-700 mb-1.5">Display order</Label>
                    <SmartInput id="sortOrder" name="sortOrder" kind="integer" defaultValue={defaultValues?.sortOrder ?? '0'} />
                </div>
            </div>

            <Label htmlFor="isActive" className="portal-text-body text-ink-700">
                <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
                Active — customers can add this to their subscription
            </Label>

            {state?.error && <p className="portal-text-body text-error-600">{state.error}</p>}

            <div className="flex items-center gap-3">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline" ><Link href="/admin/addons">
                        Cancel
                    </Link></Button>
            </div>
        </form>
    );
}
