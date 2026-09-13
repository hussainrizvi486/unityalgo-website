'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { LEAD_STATUSES } from '@/lib/leads';
import type { LeadStatus } from '@prisma/client';

export interface LeadFormState {
    error?: string;
    success?: string;
}

/** Status and internal notes are the only fields an admin edits — the name,
 *  email, phone and message are what the person actually submitted, and
 *  editing those would misrepresent the record. */
export async function updateLeadAction(
    _prev: LeadFormState | undefined,
    formData: FormData,
): Promise<LeadFormState> {
    await requireAdmin();

    const id = String(formData.get('id') ?? '');
    const status = String(formData.get('status') ?? '');
    const notes = String(formData.get('notes') ?? '').trim();

    if (!id) return { error: 'Missing lead id.' };
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
        return { error: 'Choose a valid status.' };
    }

    await prisma.lead.update({
        where: { id },
        data: { status: status as LeadStatus, notes: notes || null },
    });

    revalidatePath('/admin/leads');
    revalidatePath(`/admin/leads/${id}`);
    return { success: 'Lead updated.' };
}

export async function deleteLeadAction(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    await prisma.lead.delete({ where: { id } });
    revalidatePath('/admin/leads');
}
