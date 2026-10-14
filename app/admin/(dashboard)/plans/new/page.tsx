import { listProducts } from '@/lib/products';
import { listCurrencies } from '@/lib/currencies';
import { createPlanAction } from '@/app/admin/actions';
import { PlanForm } from '../plan-form';

export default async function NewPlanPage() {
    const [products, currencies] = await Promise.all([listProducts(), listCurrencies()]);
    return (
        <div>
            <h1 className="portal-page-title mb-8">New Plan</h1>
            <PlanForm
                products={products}
                currencies={currencies}
                action={createPlanAction}
                submitLabel="Create Plan"
            />
        </div>
    );
}
