import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { createAddressAction } from '@/app/customer/actions';
import { AddressForm } from '../address-form';

export default async function NewAddressPage() {
  const session = await requireCustomerSession();

  const existingCount = await prisma.address.count({ where: { userId: session.userId } });

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/settings/addresses" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to addresses
      </Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Addresses</p>
      <h1 className="mt-2 mb-8 text-3xl font-bold tracking-tight text-ink-950">Add address</h1>
      <AddressForm action={createAddressAction} submitLabel="Add address" lockDefault={existingCount === 0} />
    </div>
  );
}
