import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

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
    return db
        .select({
            id: schema.product.id,
            label: schema.product.label,
            slug: schema.product.slug,
            tagline: schema.product.tagline,
        })
        .from(schema.product)
        .where(eq(schema.product.isActive, true))
        .orderBy(asc(schema.product.sortOrder), asc(schema.product.label));
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
    const products = await db.query.product.findMany({
        where: and(eq(schema.product.isActive, true), eq(schema.product.showOnLanding, true)),
        orderBy: [asc(schema.product.sortOrder), asc(schema.product.label)],
        with: {
            plans: {
                where: eq(schema.plan.isActive, true),
                orderBy: [asc(schema.plan.sortOrder), asc(schema.plan.priceAmount)],
            },
        },
    });
    return products.filter((product) => product.plans.length > 0);
}


/**
 * The active plans a customer can put an AlgoSuite (Frappe) site on, in display order.
 * Used by the site wizard, the site page's plan picker and the actions that validate a chosen plan.
 */
export async function listAlgoSuitePlans() {
    const rows = await db
        .select({ plan: schema.plan })
        .from(schema.plan)
        .innerJoin(schema.product, eq(schema.product.id, schema.plan.productId))
        .where(and(eq(schema.plan.isActive, true), eq(schema.product.slug, 'algosuite')))
        .orderBy(asc(schema.plan.sortOrder));
    return rows.map((row) => row.plan);
}

/** One active AlgoSuite plan by id, or null: the server-side check that a submitted plan is really on offer. */
export async function findAlgoSuitePlan(id: string) {
    return (await listAlgoSuitePlans()).find((plan) => plan.id === id) ?? null;
}
