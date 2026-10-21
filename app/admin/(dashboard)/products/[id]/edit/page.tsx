import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { updateProductAction } from '@/app/admin/product-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminDynamicForm } from '@/components/admin/dynamic-form';
import { productFormFields } from '../../product-fields';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;
    const product = await db.query.product.findFirst({ where: eq(schema.product.id, id) });
    if (!product) notFound();

    return (
        <div>
            <AdminPageHeader title={`Edit ${product.label}`} subtitle={product.tagline ?? undefined} />
            <AdminDynamicForm
                fields={productFormFields(product, true)}
                action={updateProductAction}
                submitLabel="Save changes"
                cancelHref="/admin/products"
                hidden={{ id: product.id }}
            />
        </div>
    );
}
