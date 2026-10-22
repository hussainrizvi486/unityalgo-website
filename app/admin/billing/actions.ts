'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-session';
import { grantCustomerCredit } from '@/lib/customer-credits';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { moneyToMinor, currencyDigits } from '@/lib/billing-rules';

export async function grantCreditAction(input: { userId: string; currency: string; amount: string; reason: string; operationKey: string }) {
    const admin = await requireAdmin();
    try {
        const customer = await db.query.user.findFirst({ where: and(eq(schema.user.id, input.userId), eq(schema.user.role, 'CUSTOMER')) });
        if (!customer) throw new Error('Customer not found.');
        if (!/^\d+(\.\d+)?$/.test(input.amount)) throw new Error('Enter a positive credit amount.');
        const currency = input.currency.toUpperCase();
        const configured = await db.query.currency.findFirst({ where: and(eq(schema.currency.code, currency), eq(schema.currency.isActive, true)) });
        if (!configured) throw new Error('Select an active billing currency.');
        if ((input.amount.split('.')[1]?.length ?? 0) > currencyDigits(currency)) throw new Error('This amount has too many decimal places for the currency.');
        const amount = Number(moneyToMinor(Number(input.amount), currency));
        await grantCustomerCredit({ ...input, currency, amount, actorId: admin.id });
        revalidatePath(`/admin/users/${input.userId}`);
        revalidatePath('/dashboard/subscription');
        return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not assign credit.' }; }
}
