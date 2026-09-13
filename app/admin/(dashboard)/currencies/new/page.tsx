import { requireAdmin } from '@/lib/admin-session';
import { createCurrencyAction } from '@/app/admin/currency-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminDynamicForm } from '@/components/admin/dynamic-form';
import { currencyFormFields } from '../currency-fields';

export default async function NewCurrencyPage() {
    await requireAdmin();
    return (
        <div>
            <AdminPageHeader title="Add currency" subtitle="Plans can be priced in any enabled currency." />
            <AdminDynamicForm
                fields={currencyFormFields()}
                action={createCurrencyAction}
                submitLabel="Add currency"
                cancelHref="/admin/currencies"
            />
        </div>
    );
}
