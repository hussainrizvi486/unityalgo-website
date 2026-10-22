'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleRenewalCreditsAction, releaseRenewalCreditsAction } from '@/app/customer/actions';
import { Button } from '@/components/ui/button';

export function RenewalCreditButtons({ subscriptionId, redemptionId }: { subscriptionId: string; redemptionId?: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    return <div className="mt-3">
        <Button type="button" variant="outline" disabled={busy} onClick={async () => {
            setBusy(true); setMessage('');
            try {
                const result = redemptionId ? await releaseRenewalCreditsAction(redemptionId) : await scheduleRenewalCreditsAction(subscriptionId);
                if (!result.ok) throw new Error(result.error);
                setMessage(redemptionId ? 'Scheduled credits returned to your available balance.' : 'Credits reserved for your next renewal. Unused credits will return to your balance after billing.');
                router.refresh();
            } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update renewal credits.'); }
            finally { setBusy(false); }
        }}>{busy ? 'Updating credits…' : redemptionId ? 'Release scheduled renewal credits' : 'Use credits on next renewal'}</Button>
        {message ? <p role="status" className="mt-2 text-sm">{message}</p> : null}
    </div>;
}
