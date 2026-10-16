import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { updateAddressAction } from '@/app/customer/actions';
import { AddressForm } from '../../address-form';

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomerSession();

  const address = await db.query.address.findFirst({ where: eq(schema.address.id, id) });
  if (!address || address.userId !== session.userId) {
    notFound();
  }

  const boundUpdateAction = updateAddressAction.bind(null, address.id);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/settings/addresses" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
        <ArrowLeft className="h-4 w-4" />Back to addresses
      </Link>
      <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Addresses</p>
      <h1 className="portal-page-title mt-2 mb-8">Edit address</h1>
      <AddressForm
        action={boundUpdateAction}
        submitLabel="Save changes"
        defaultValues={{
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 ?? '',
          city: address.city,
          state: address.state,
          country: address.country,
          postcode: address.postcode,
          isDefault: address.isDefault,
        }}
      />
    </div>
  );
}
