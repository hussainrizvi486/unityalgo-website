import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

/**
 * Currencies offerable on a plan.
 *
 * Only enabled ones: a plan already priced in a disabled currency keeps it
 * until an admin changes it, but a disabled currency is not offered for a new
 * one. Mirrors how `listProducts` gates on isActive.
 */
export function listCurrencies() {
    return db
        .select({
            id: schema.currency.id,
            code: schema.currency.code,
            name: schema.currency.name,
            symbol: schema.currency.symbol,
            numberFormat: schema.currency.numberFormat,
        })
        .from(schema.currency)
        .where(eq(schema.currency.isActive, true))
        .orderBy(asc(schema.currency.sortOrder), asc(schema.currency.code));
}
