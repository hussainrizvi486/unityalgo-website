import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { createAddressAction } from '@/app/customer/actions';
import { AddressForm } from '../address-form';

export default async function NewAddressPage() {
  const session = await requireCustomerSession();

  const existingCount = await db.$count(schema.address, eq(schema.address.userId, session.userId));

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/settings/addresses" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
        <ArrowLeft className="h-4 w-4" />Back to addresses
      </Link>
      <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Addresses</p>
      <h1 className="portal-page-title mt-2 mb-8">Add address</h1>
      <AddressForm action={createAddressAction} submitLabel="Add address" lockDefault={existingCount === 0} />
    </div>
  );
}
