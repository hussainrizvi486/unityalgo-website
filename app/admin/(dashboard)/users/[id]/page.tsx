import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Boxes, CreditCard, Store } from 'lucide-react';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { tenantsForUser } from '@/lib/tenant-accounts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TENANT_STATUS_BADGE, TENANT_STATUS_LABEL } from '@/lib/controller-status';

const money = (amount: number | null, currency = 'USD') =>
    amount === null
        ? 'Custom'
        : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const date = (value: Date) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(value);

/**
 * A customer's account: who they are, what they subscribe to, and which
 * storefronts those subscriptions run.
 *
 * The tenants come from the controller rather than Prisma — they live in an
 * Alembic-owned table that Prisma cannot join to — so the section degrades to
 * a notice if the controller is down instead of failing the page.
 */
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;

    const user = await db.query.user.findFirst({
        where: eq(schema.user.id, id),
        with: {
            subscriptions: {
                with: { plan: true, product: true, addOns: { with: { addOn: true } } },
                orderBy: desc(schema.subscription.createdAt),
            },
            addresses: { orderBy: desc(schema.address.isDefault) },
        },
    });
    if (!user) notFound();

    const tenants = await tenantsForUser(user.id);
    const displayName = user.name ?? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ?? user.email;

    // Which subscription each storefront belongs to, so a subscription row can
    // point at the store it funds.
    const storeFor = new Map((tenants ?? []).map((t) => [t.subscription_id, t]));

    return (
        <div className="portal-detail">
            <Link href="/admin/users" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to users
            </Link>

            <div className="flex items-start justify-between gap-gap">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="portal-page-title">{displayName || user.email}</h1>
                        <Badge variant={user.role === 'ADMIN' ? 'neutral' : 'info'}>
                            {user.role === 'ADMIN' ? 'Admin' : 'Customer'}
                        </Badge>
                    </div>
                    <p className="mt-1 portal-text-body text-muted-foreground">
                        {user.email}
                        {user.company ? ` · ${user.company}` : ''} · joined {date(user.createdAt)}
                    </p>
                </div>
                <Button asChild variant="outline" ><Link href={`/admin/users/${user.id}/edit`}>Edit</Link></Button>
            </div>

            {/* --- subscriptions --- */}
            <section className="mt-8 p-5 sm:p-6 portal-surface">
                <h2 className="flex items-center gap-2 text-foreground">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />Subscriptions
                </h2>
                {user.subscriptions.length === 0 ? (
                    <p className="mt-4 portal-text-body text-muted-foreground">No subscriptions.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-border/60">
                        {user.subscriptions.map((sub) => {
                            const store = storeFor.get(sub.id);
                            return (
                                <li key={sub.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                                    <div>
                                        <div className="font-medium text-foreground">
                                            {sub.plan.name}
                                            <span className="ml-2 portal-text-caption font-normal text-muted-foreground">
                                                {sub.product.label}
                                            </span>
                                        </div>
                                        <div className="portal-text-body text-muted-foreground">
                                            {money(sub.plan.priceAmount)} · started {date(sub.startedAt)}
                                            {sub.storeName ? ` · ${sub.storeName}` : ''}
                                        </div>
                                        {sub.productId === 'unity_commerce' && (
                                            <div className="mt-1 portal-text-body">
                                                {store ? (
                                                    <Link href={`/admin/tenants/${store.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                                                        <Store className="h-3.5 w-3.5" />{store.tenant_slug}
                                                    </Link>
                                                ) : tenants === null ? (
                                                    <span className="text-muted-foreground">Storefront status unavailable</span>
                                                ) : (
                                                    <Link href="/admin/tenants/new" className="font-medium text-primary hover:underline">
                                                        No storefront yet — create one →
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Badge variant={sub.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                        {sub.status.charAt(0) + sub.status.slice(1).toLowerCase()}
                                    </Badge>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* --- storefronts --- */}
            <section className="mt-6 p-5 sm:p-6 portal-surface">
                <h2 className="flex items-center gap-2 text-foreground">
                    <Boxes className="h-4 w-4 text-muted-foreground" />Storefronts
                </h2>
                {tenants === null ? (
                    <p className="mt-4 portal-text-body text-muted-foreground">
                        The controller is unreachable, so this customer&apos;s storefronts cannot be listed.
                    </p>
                ) : tenants.length === 0 ? (
                    <p className="mt-4 portal-text-body text-muted-foreground">No storefronts.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-border/60">
                        {tenants.map((tenant) => (
                            <li key={tenant.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                                <div>
                                    <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                                        {tenant.tenant_slug}
                                    </Link>
                                    <div className="portal-text-body text-muted-foreground">
                                        {tenant.custom_domain ?? tenant.assigned_subdomain ?? '—'}
                                        {' · '}{tenant.subscription?.plan?.name ?? tenant.plan_tier}
                                    </div>
                                </div>
                                <Badge variant={TENANT_STATUS_BADGE[tenant.status]}>
                                    {TENANT_STATUS_LABEL[tenant.status]}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* --- addresses --- */}
            {user.addresses.length > 0 && (
                <section className="mt-6 p-5 sm:p-6 portal-surface">
                    <h2 className=" text-foreground">Addresses</h2>
                    <ul className="mt-4 grid gap-gap sm:grid-cols-2">
                        {user.addresses.map((address) => (
                            <li key={address.id} className="portal-text-body text-foreground/70">
                                {address.isDefault && <Badge variant="neutral" className="mb-1.5">Default</Badge>}
                                <div>{address.addressLine1}</div>
                                {address.addressLine2 && <div>{address.addressLine2}</div>}
                                <div>
                                    {[address.city, address.state, address.postcode].filter(Boolean).join(', ')}
                                </div>
                                <div>{address.country}</div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
