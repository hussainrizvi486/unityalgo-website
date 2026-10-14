'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteButton } from '@/components/admin/delete-button';
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from '@/lib/leads';
import { updateLeadAction, deleteLeadAction } from '@/app/admin/lead-actions';
import type { LeadStatus } from '@prisma/client';

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving…' : 'Save'}
        </Button>
    );
}

export function LeadForm({ id, status, notes }: { id: string; status: LeadStatus; notes: string }) {
    const [state, formAction] = useActionState(updateLeadAction, undefined);

    return (
        <form action={formAction} className="portal-fields">
            <input type="hidden" name="id" value={id} />

            {state?.error && (
                <Notice tone="error">{state.error}</Notice>
            )}
            {state?.success && (
                <Notice tone="success">{state.success}</Notice>
            )}

            <FormField id="status" label="Status">
                <Select name="status" defaultValue={status}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {LEAD_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>{LEAD_STATUS_LABEL[value]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FormField>

            <FormField id="notes" label="Internal notes" help="Never shown to the person who submitted." optional>
                <Textarea id="notes" name="notes" rows={6} defaultValue={notes} placeholder="Called on 2 Sep — asked for a quote." />
            </FormField>

            <div className="flex items-center gap-3 border-t border-ink-200 pt-5">
                <SaveButton />
                <Button asChild type="button" variant="outline"><Link href="/admin/leads">Back</Link></Button>
                <div className="ml-auto">
                    <DeleteButton
                        action={deleteLeadAction}
                        id={id}
                        title="Delete this lead?"
                        description="The enquiry is removed permanently. This cannot be undone."
                    />
                </div>
            </div>
        </form>
    );
}
