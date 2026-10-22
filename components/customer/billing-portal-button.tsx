'use client';
import { useState } from 'react';
import { openBillingPortalAction } from '@/app/customer/actions';
import { Button } from '@/components/ui/button';

export function BillingPortalButton({ subscriptionId }: { subscriptionId: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return <div className="mt-4">
        <Button variant="outline" disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            try { window.location.assign(await openBillingPortalAction(subscriptionId)); }
            catch { setError('Billing portal is unavailable. Please try again.'); setBusy(false); }
        }}>{busy ? 'Opening billing…' : 'Manage payments, invoices and cancellation'}</Button>
        {error ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
    </div>;
}
