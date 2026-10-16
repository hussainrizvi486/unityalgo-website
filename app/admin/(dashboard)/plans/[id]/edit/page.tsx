import { listProducts } from '@/lib/products';
import { listCurrencies } from '@/lib/currencies';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { updatePlanAction } from '@/app/admin/actions';
import { PlanForm } from '../../plan-form';

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const [products, currencies] = await Promise.all([listProducts(), listCurrencies()]);
    const { id } = await params;
    const plan = await db.query.plan.findFirst({ where: eq(schema.plan.id, id) });

    if (!plan) {
        notFound();
    }

    const boundUpdateAction = updatePlanAction.bind(null, plan.id);

    return (
        <div>
            <h1 className="portal-page-title mb-8">Edit Plan</h1>
            <PlanForm
                    currencies={currencies}
                products={products}
                action={boundUpdateAction}
                submitLabel="Save Changes"
                defaultValues={{
                    product: plan.productId,
                    name: plan.name,
                    slug: plan.slug,
                    tagline: plan.tagline ?? '',
                    priceUnit: plan.priceUnit,
                    priceAmount: plan.priceAmount != null ? String(plan.priceAmount) : '',
                    paddlePriceId: plan.paddlePriceId ?? '',
                    currencyId: plan.currencyId ?? '',
                    transactionFeePercent: plan.transactionFeePercent != null ? String(plan.transactionFeePercent) : '',
                    userLimit: plan.userLimit != null ? String(plan.userLimit) : '',
                    vcpu: plan.vcpu != null ? String(plan.vcpu) : '',
                    ramMb: plan.ramMb != null ? String(plan.ramMb) : '',
                    storageGb: plan.storageGb != null ? String(plan.storageGb) : '',
                    features: plan.features.join('\n'),
                    isActive: plan.isActive,
                    sortOrder: String(plan.sortOrder),
                }}
            />
        </div>
    );
}
