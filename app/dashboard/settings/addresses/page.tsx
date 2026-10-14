import Link from 'next/link';
import { ArrowLeft, MapPin, Pencil, Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { deleteAddressAction, setDefaultAddressAction } from '@/app/customer/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '@/components/admin/delete-button';

export default async function AddressesPage() {
  const session = await requireCustomerSession();

  const addresses = await prisma.address.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="mx-auto portal-page">
      <Link href="/dashboard/settings" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to settings
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <p className="portal-text-caption font-bold uppercase tracking-[.18em] text-brand">Settings</p>
          <h1 className="portal-page-title mt-2">Addresses</h1>
          <p className="mt-2 portal-text-body text-ink-500">Manage the addresses on your account.</p>
        </div>
        <Button asChild className="rounded-md"><Link href="/dashboard/settings/addresses/new">Add address</Link></Button>
      </div>

      {addresses.length === 0 ? (
        <section className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-6 text-center">
          <MapPin className="h-10 w-10 text-ink-300" />
          <h2 className="mt-4 text-lg font-bold text-ink-900">No addresses yet</h2>
          <p className="mt-2 max-w-sm portal-text-body text-ink-500">Add an address to speed up checkout and support requests.</p>
        </section>
      ) : (
        <div className="mt-8 space-y-4">
          {addresses.map((address) => (
            <div key={address.id} className="p-5 sm:p-6 portal-surface">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand"><MapPin className="h-4 w-4" /></span>
                  <div className="portal-text-body text-ink-700">
                    <div className="mb-1.5 flex items-center gap-2">
                      {address.isDefault ? <Badge variant="brand">Default</Badge> : null}
                    </div>
                    <p className="font-semibold text-ink-900">{address.addressLine1}</p>
                    {address.addressLine2 ? <p>{address.addressLine2}</p> : null}
                    <p>{address.city}, {address.state} {address.postcode}</p>
                    <p>{address.country}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!address.isDefault ? (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="id" value={address.id} />
                      <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                        <Star className="h-3.5 w-3.5" />Set as default
                      </Button>
                    </form>
                  ) : null}
                  <Button asChild size="sm" variant="outline" className="gap-1.5"><Link href={`/dashboard/settings/addresses/${address.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Link></Button>
                  <DeleteButton
                    action={deleteAddressAction}
                    id={address.id}
                    title="Delete this address?"
                    description={`The address at "${address.addressLine1}" will be permanently deleted.`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
