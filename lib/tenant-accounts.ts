import 'server-only';
import { prisma } from '@/lib/db';
import { controller } from '@/lib/controller-client';

/**
 * The customer/subscription/plan side of a tenant.
 *
 * Tenants live in the controller's `tenants` table (Alembic-owned) while
 * customers, plans and subscriptions live in Prisma's — see
 * controller/README.md. Neither side can join across the boundary in one
 * query, so the two halves are fetched separately and matched here on the
 * subscription id that both carry.
 */

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

/**
 * Every UnityCommerce subscription, marked with whether a tenant already
 * claims it.
 *
 * Claimed ones are returned rather than filtered out so the picker can show
 * them greyed out with the store that holds them — a subscription vanishing
 * from the list with no explanation is the more confusing failure.
 */
export async function listSubscriptionOptions(): Promise<SubscriptionOption[]> {
    const subscriptions = await prisma.subscription.findMany({
        // Mirrors UNUSABLE_SUBSCRIPTION_STATUSES in the controller's
        // account_resolver: a canceled subscription cannot take a new store.
        where: { productId: 'unity_commerce', status: { not: 'CANCELED' } },
        select: {
            id: true, status: true, storeName: true,
            plan: { select: { name: true, slug: true } },
            user: { select: { name: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    if (subscriptions.length === 0) return [];

    // A controller outage must not take down the whole page — without this
    // the "new tenant" form would 500 rather than simply not knowing which
    // subscriptions are spoken for.
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
        return null; // Controller unreachable; the page renders without the section.
    }
}
