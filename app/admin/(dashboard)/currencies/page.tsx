import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { deleteCurrencyAction } from '@/app/admin/currency-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { formatCurrencyAmount } from '@/lib/currency';
import { CurrenciesList, type CurrencyRow } from './currencies-list';

export default async function AdminCurrenciesPage() {
    await requireAdmin();

    const currencies = await db
        .select({ ...getTableColumns(schema.currency), planCount: sql<number>`count(${schema.plan.id})::int` })
        .from(schema.currency)
        .leftJoin(schema.plan, eq(schema.plan.currencyId, schema.currency.id))
        .groupBy(schema.currency.id)
        .orderBy(asc(schema.currency.sortOrder), asc(schema.currency.code));

    const rows: CurrencyRow[] = currencies.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        numberFormat: c.numberFormat,
        // A worked example beats the raw pattern for telling formats apart.
        sample: formatCurrencyAmount(1234567.89, c),
        isActive: c.isActive,
        planCount: c.planCount,
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
