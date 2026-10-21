import { requireAdmin } from '@/lib/admin-session';
import { createProductAction } from '@/app/admin/product-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminDynamicForm } from '@/components/admin/dynamic-form';
import { productFormFields } from '../product-fields';

export default async function NewProductPage() {
    await requireAdmin();
    return (
        <div>
            <AdminPageHeader title="Add product" subtitle="Products group the plans and add-ons customers can subscribe to." />
            <AdminDynamicForm
                fields={productFormFields()}
                action={createProductAction}
                submitLabel="Add product"
                cancelHref="/admin/products"
            />
        </div>
    );
}
