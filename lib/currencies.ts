import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Currencies offerable on a plan.
 *
 * Only enabled ones: a plan already priced in a disabled currency keeps it
 * until an admin changes it, but a disabled currency is not offered for a new
 * one. Mirrors how `listProducts` gates on isActive.
 */
export function listCurrencies() {
    return prisma.currency.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, symbol: true, numberFormat: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
}
