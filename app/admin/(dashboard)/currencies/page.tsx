import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { deleteCurrencyAction } from '@/app/admin/currency-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { formatCurrencyAmount } from '@/lib/currency';
import { CurrenciesList, type CurrencyRow } from './currencies-list';

export default async function AdminCurrenciesPage() {
    await requireAdmin();

    const currencies = await prisma.currency.findMany({
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: { _count: { select: { plans: true } } },
    });

    const rows: CurrencyRow[] = currencies.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        numberFormat: c.numberFormat,
        // A worked example beats the raw pattern for telling formats apart.
        sample: formatCurrencyAmount(1234567.89, c),
        isActive: c.isActive,
        planCount: c._count.plans,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Currencies"
                subtitle="Currencies plans can be priced in, and how their amounts are written."
                action={{ label: 'Add currency', href: '/admin/currencies/new' }}
            />
            <CurrenciesList rows={rows} deleteAction={deleteCurrencyAction} />
        </div>
    );
}
