'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import type { AdminFormState } from '@/components/admin/dynamic-form';
import { NUMBER_FORMATS } from '@/lib/currency';

/**
 * Admin actions for currencies.
 *
 * Every action re-checks the admin session rather than trusting the page that
 * rendered the form.
 */

function readFields(formData: FormData) {
    const format = String(formData.get('numberFormat') ?? '#,###.##');
    return {
        // Codes are conventionally upper case, and the column's CHECK requires it.
        code: String(formData.get('code') ?? '').trim().toUpperCase(),
        name: String(formData.get('name') ?? '').trim(),
        symbol: String(formData.get('symbol') ?? '').trim(),
        numberFormat: (NUMBER_FORMATS as readonly string[]).includes(format) ? format : '#,###.##',
        isActive: formData.get('isActive') === 'on',
        sortOrder: Number(formData.get('sortOrder') ?? 0) || 0,
    };
}

function validate(f: ReturnType<typeof readFields>) {
    if (!f.code) return 'A currency code is required.';
    if (!/^[A-Z]{3,8}$/.test(f.code)) return 'Code must be 3–8 letters, e.g. USD or PKR.';
    if (!f.name) return 'A currency name is required.';
    if (!f.symbol) return 'A symbol is required.';
    return null;
}

function friendly(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes('Currency_code_key')) return 'A currency with that code already exists.';
    return 'Could not save the currency. Check the values and try again.';
}

export async function createCurrencyAction(
    _prev: AdminFormState | undefined,
    formData: FormData,
): Promise<AdminFormState> {
    await requireAdmin();
    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };

    try {
        await prisma.currency.create({ data: fields });
    } catch (error) {
        return { error: friendly(error) };
    }
    revalidatePath('/admin/currencies');
    redirect('/admin/currencies');
}

export async function updateCurrencyAction(
    _prev: AdminFormState | undefined,
    formData: FormData,
): Promise<AdminFormState> {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return { error: 'Missing currency id.' };

    const fields = readFields(formData);
    const invalid = validate(fields);
    if (invalid) return { error: invalid };

    try {
        await prisma.currency.update({ where: { id }, data: fields });
    } catch (error) {
        return { error: friendly(error) };
    }
    revalidatePath('/admin/currencies');
    redirect('/admin/currencies');
}

export async function deleteCurrencyAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    // Plans referencing it are not deleted — the foreign key is ON DELETE SET
    // NULL, so they fall back to the default display currency instead.
    await prisma.currency.delete({ where: { id } });
    revalidatePath('/admin/currencies');
    revalidatePath('/admin/plans');
}
