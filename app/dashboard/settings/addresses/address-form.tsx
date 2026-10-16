'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { AccountFormState } from '@/app/customer/actions';

export interface AddressFormValues {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
  isDefault: boolean;
}


function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="rounded-md">
      {pending ? 'Saving…' : label}
    </Button>
  );
}

interface AddressFormProps {
  action: (prevState: AccountFormState | undefined, formData: FormData) => Promise<AccountFormState>;
  defaultValues?: Partial<AddressFormValues>;
  submitLabel: string;
  lockDefault?: boolean;
}

export function AddressForm({ action, defaultValues, submitLabel, lockDefault }: AddressFormProps) {
  const [state, formAction] = useActionState<AccountFormState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="portal-fields">
      <div>
        <Label htmlFor="addressLine1" className="mb-1.5 portal-text-body text-foreground/80">Address line 1</Label>
        <Input id="addressLine1" name="addressLine1" required defaultValue={defaultValues?.addressLine1} placeholder="123 Main Street" />
      </div>
      <div>
        <Label htmlFor="addressLine2" className="mb-1.5 portal-text-body text-foreground/80">
          Address line 2 <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="addressLine2" name="addressLine2" defaultValue={defaultValues?.addressLine2} placeholder="Apartment, suite, unit, etc." />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="city" className="mb-1.5 portal-text-body text-foreground/80">City</Label>
          <Input id="city" name="city" required defaultValue={defaultValues?.city} />
        </div>
        <div>
          <Label htmlFor="state" className="mb-1.5 portal-text-body text-foreground/80">State</Label>
          <Input id="state" name="state" required defaultValue={defaultValues?.state} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="country" className="mb-1.5 portal-text-body text-foreground/80">Country</Label>
          <Input id="country" name="country" required defaultValue={defaultValues?.country} />
        </div>
        <div>
          <Label htmlFor="postcode" className="mb-1.5 portal-text-body text-foreground/80">Postcode</Label>
          <Input id="postcode" name="postcode" required defaultValue={defaultValues?.postcode} />
        </div>
      </div>

      {lockDefault ? (
        <p className="portal-text-body text-muted-foreground">This is your only address, so it&apos;s automatically your default.</p>
      ) : (
        <Label htmlFor="isDefault" className="portal-text-body text-foreground/80">
          <Checkbox id="isDefault" name="isDefault" defaultChecked={defaultValues?.isDefault} />
          Set as default address
        </Label>
      )}

      {state?.error ? <Notice tone="error">{state.error}</Notice> : null}

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Button asChild type="button" variant="outline" className="rounded-md"><Link href="/dashboard/settings/addresses">
            Cancel
          </Link></Button>
      </div>
    </form>
  );
}
