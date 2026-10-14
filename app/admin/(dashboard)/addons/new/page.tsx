import { listProducts } from '@/lib/products';
import { createAddOnAction } from '@/app/admin/actions';
import { AddOnForm } from '../addon-form';

export default async function NewAddOnPage() {
    const products = await listProducts();
    return (
        <div>
            <h1 className="portal-page-title mb-8">New Add-on</h1>
            <AddOnForm
                products={products} action={createAddOnAction} submitLabel="Create Add-on" />
        </div>
    );
}
