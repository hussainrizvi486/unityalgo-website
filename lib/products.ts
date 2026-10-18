import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

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

export async function listProductsWithPlans() {
    const products = await db.query.product.findMany({
        where: and(eq(schema.product.isActive, true), eq(schema.product.showOnLanding, true)),
        orderBy: [asc(schema.product.sortOrder), asc(schema.product.label)],
        with: {
            plans: {
                where: eq(schema.plan.isActive, true),
                orderBy: [asc(schema.plan.sortOrder), asc(schema.plan.priceAmount)],
                with: { currency: true },
            },
        },
    });
    return products.filter((product) => product.plans.length > 0);
}

export async function listAlgoSuitePlans() {
    const rows = await db
        .select({ plan: schema.plan, currency: schema.currency })
        .from(schema.plan)
        .innerJoin(schema.product, eq(schema.product.id, schema.plan.productId))
        .leftJoin(schema.currency, eq(schema.currency.id, schema.plan.currencyId))
        .where(and(eq(schema.plan.isActive, true), eq(schema.product.slug, 'algosuite')))
        .orderBy(asc(schema.plan.sortOrder));
    return rows.map((row) => ({ ...row.plan, currency: row.currency }));
}

export async function findAlgoSuitePlan(id: string) {
    return (await listAlgoSuitePlans()).find((plan) => plan.id === id) ?? null;
}
