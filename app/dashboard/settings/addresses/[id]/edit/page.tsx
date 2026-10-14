import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { updateAddressAction } from '@/app/customer/actions';
import { AddressForm } from '../../address-form';

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomerSession();

  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== session.userId) {
    notFound();
  }

  const boundUpdateAction = updateAddressAction.bind(null, address.id);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/settings/addresses" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to addresses
      </Link>
      <p className="portal-text-caption font-bold uppercase tracking-[.18em] text-brand">Addresses</p>
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
