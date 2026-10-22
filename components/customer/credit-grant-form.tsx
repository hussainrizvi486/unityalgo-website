'use client';
import { useState } from 'react';
import { grantCreditAction } from '@/app/admin/billing/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreditGrantForm({ userId, operationKey: initialKey }: { userId: string; operationKey: string }) {
    const [key, setKey] = useState(initialKey);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    return <form className="mt-4 space-y-3" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setMessage('');
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            const result = await grantCreditAction({ userId, operationKey: key, currency: String(data.get('currency')), amount: String(data.get('amount')), reason: String(data.get('reason')) });
            setMessage(result.ok ? 'Credits assigned to the customer account.' : result.error ?? 'Could not assign credit.');
            if (result.ok) { setKey(crypto.randomUUID()); form.reset(); }
        } catch { setMessage('Could not confirm the result. Retry this form to check the same credit assignment.'); }
        finally { setBusy(false); }
    }}>
        <div className="flex flex-wrap gap-3">
            <label>Currency<Input name="currency" defaultValue="USD" pattern="[A-Za-z]{3}" maxLength={3} required /></label>
            <label>Amount<Input name="amount" inputMode="decimal" placeholder="10.00" required /></label>
        </div>
        <label className="block">Reason<Input name="reason" maxLength={1000} required /></label>
        <Button type="submit" disabled={busy}>{busy ? 'Assigning…' : 'Assign credit'}</Button>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
    </form>;
}
