import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { deleteProductAction, toggleProductActiveAction } from '@/app/admin/product-actions';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { ProductsList, type ProductRow } from './products-list';

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    await requireAdmin();
    const { error } = await searchParams;

    const products = await db
        .select({ ...getTableColumns(schema.product), planCount: sql<number>`count(distinct ${schema.plan.id})::int` })
        .from(schema.product)
        .leftJoin(schema.plan, eq(schema.plan.productId, schema.product.id))
        .groupBy(schema.product.id)
        .orderBy(asc(schema.product.sortOrder), asc(schema.product.label));

    const rows: ProductRow[] = products.map((product) => ({
        id: product.id,
        label: product.label,
        slug: product.slug,
        tagline: product.tagline,
        planCount: product.planCount,
        isActive: product.isActive,
        showOnLanding: product.showOnLanding,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Products"
                subtitle={`${rows.length} total`}
                action={{ label: 'Add product', href: '/admin/products/new' }}
            />
            {error && <AdminPageError message={error} />}
            <ProductsList rows={rows} deleteAction={deleteProductAction} toggleAction={toggleProductActiveAction} />
        </div>
    );
}
