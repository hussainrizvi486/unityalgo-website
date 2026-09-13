import 'server-only';
import { prisma } from '@/lib/db';

/**
 * The products UnityAlgo sells, read from the `Product` table.
 *
 * These used to be members of a Prisma enum, which meant adding a product was
 * a schema migration and a redeploy. They are rows now, so a label, tagline or
 * ordering change is a data edit — and anything rendering a product list
 * (the landing page's plans section, the admin forms) picks it up on the next
 * request.
 */

export interface ProductOption {
    id: string;
    label: string;
    slug: string;
    tagline: string | null;
}

/** Every active product, in display order. */
export async function listProducts(): Promise<ProductOption[]> {
    return prisma.product.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: { id: true, label: true, slug: true, tagline: true },
    });
}

/**
 * Active products with their active plans, for the public pricing sections.
 *
 * A product with no active plans is dropped rather than rendered as an empty
 * column.
 */
/**
 * Products advertised in the landing page's plans section.
 *
 * Gated on `showOnLanding` as well as `isActive`, so a product can stay fully
 * sellable to anyone who reaches its own page while not yet being promoted on
 * the home page.
 */
export async function listProductsWithPlans() {
    const products = await prisma.product.findMany({
        where: { isActive: true, showOnLanding: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        include: {
            plans: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { priceAmount: 'asc' }],
            },
        },
    });
    return products.filter((product) => product.plans.length > 0);
}
