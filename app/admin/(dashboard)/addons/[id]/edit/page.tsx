import { listProducts } from '@/lib/products';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { updateAddOnAction } from '@/app/admin/actions';
import { AddOnForm } from '../../addon-form';

export default async function EditAddOnPage({ params }: { params: Promise<{ id: string }> }) {
    const products = await listProducts();
    const { id } = await params;
    const addOn = await db.query.addOn.findFirst({ where: eq(schema.addOn.id, id) });

    if (!addOn) {
        notFound();
    }

    const boundUpdateAction = updateAddOnAction.bind(null, addOn.id);

    return (
        <div>
            <h1 className="portal-page-title mb-8">Edit Add-on</h1>
            <AddOnForm
                products={products}
                action={boundUpdateAction}
                submitLabel="Save Changes"
                defaultValues={{
                    product: addOn.productId,
                    name: addOn.name,
                    slug: addOn.slug,
                    description: addOn.description ?? '',
                    pricingType: addOn.pricingType,
                    priceAmount: addOn.priceAmount != null ? String(addOn.priceAmount) : '',
                    isActive: addOn.isActive,
                    sortOrder: String(addOn.sortOrder),
                }}
            />
        </div>
    );
}
