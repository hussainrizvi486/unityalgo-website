import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { updateCurrencyAction } from '@/app/admin/currency-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminDynamicForm } from '@/components/admin/dynamic-form';
import { currencyFormFields } from '../../currency-fields';

export default async function EditCurrencyPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAdmin();
    const { id } = await params;

    const currency = await db.query.currency.findFirst({ where: eq(schema.currency.id, id) });
    if (!currency) notFound();

    return (
        <div>
            <AdminPageHeader title={`Edit ${currency.code}`} subtitle={currency.name} />
            <AdminDynamicForm
                fields={currencyFormFields(currency)}
                action={updateCurrencyAction}
                submitLabel="Save changes"
                cancelHref="/admin/currencies"
                hidden={{ id: currency.id }}
            />
        </div>
    );
}
