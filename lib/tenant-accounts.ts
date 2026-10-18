import 'server-only';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';

export interface SubscriptionOption {
    id: string;
    customerName: string;
    customerEmail: string;
    planName: string;
    planSlug: string;
    storeName: string | null;
    status: string;
    /** The slug of the tenant already using it, if any. */
    claimedBy: string | null;
}

function displayName(user: { name: string | null; firstName: string | null; lastName: string | null; email: string }) {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return user.name ?? (full || user.email);
}

export async function listSubscriptionOptions(): Promise<SubscriptionOption[]> {
    const subscriptions = await db.query.subscription.findMany({
        where: and(eq(schema.subscription.productId, 'unity_commerce'), ne(schema.subscription.status, 'CANCELED')),
        columns: { id: true, status: true, storeName: true },
        with: {
            plan: { columns: { name: true, slug: true } },
            user: { columns: { name: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: desc(schema.subscription.createdAt),
    });
    if (subscriptions.length === 0) return [];

    const claims = new Map<string, string>();
    try {
        for (const tenant of (await controller.tenants.list()).results ?? []) {
            if (tenant.subscription_id) claims.set(tenant.subscription_id, tenant.tenant_slug);
        }
    } catch {
        // Leave every option selectable; the API still rejects a duplicate.
    }

    return subscriptions.map((s) => ({
        id: s.id,
        customerName: displayName(s.user),
        customerEmail: s.user.email,
        planName: s.plan.name,
        planSlug: s.plan.slug,
        storeName: s.storeName,
        status: s.status,
        claimedBy: claims.get(s.id) ?? null,
    }));
}

/** The tenants belonging to one customer, for their admin detail page. */
export async function tenantsForUser(userId: string) {
    try {
        return (await controller.tenants.list({ user_id: userId })).results ?? [];
    } catch {
        return null;
    }
}
