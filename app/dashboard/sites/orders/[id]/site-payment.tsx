'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializePaddle, CheckoutEventNames, type Paddle } from '@paddle/paddle-js';
import { cancelSiteSetupAction, startSitePaymentAction, sitePaymentStatusAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { CREDITS_ENABLED } from '@/lib/billing-features';

/** `returning`: the customer came back from Paddle's checkout (successUrl), so confirm the payment right away. */
export function SitePayment({ orderId, trial, initialStatus, transactionId, returning = false, covered = false }: { orderId: string; trial: boolean; initialStatus: string; transactionId: string | null; returning?: boolean; covered?: boolean }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(initialStatus);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [slow, setSlow] = useState(false);
    const [useCredits, setUseCredits] = useState(CREDITS_ENABLED);
    const paddle = useRef<Paddle | undefined>(undefined);
    const verifying = useRef(returning);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        if (returning) void check(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!returning || status === 'READY') return;
        const timer = setTimeout(() => setSlow(true), 90_000);
        return () => clearTimeout(timer);
    }, [returning, status]);
    async function check(verify = false) {
        try {
            const result = await sitePaymentStatusAction(orderId, verify);
            if (!mounted.current) return;
            setStatus(result.status);
            if (result.error) setError(result.error);
            if (result.siteId) router.replace(`/dashboard/sites/${result.siteId}`);
        } catch { if (mounted.current) setError('Your payment is still being checked. Keep this page open or return from Sites; you do not need to pay again.'); }
    }
    useEffect(() => {
        if (status !== 'READY' && status !== 'AWAITING_PAYMENT') return;
        const timer = setInterval(() => { void check(verifying.current); }, 3000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, orderId]);
    async function pay() {
        setBusy(true); setError('');
        try {
            const result = await startSitePaymentAction(orderId, useCredits);
            if (!result.ok) throw new Error(result.error);
            if ('authorized' in result && result.authorized) {
                if ('claimed' in result && result.claimed) setNotice('Using the subscription you already pay for, so there is nothing to pay. Your site is being created.');
                setStatus('READY'); await check(); return;
            }
            const id = 'transactionId' in result ? result.transactionId : transactionId;
            if (!id) throw new Error('Checkout is unavailable. Your details are saved.');
            const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
            if (!token) throw new Error('Online payment is not configured. Your details are saved.');
            paddle.current = await initializePaddle({
                token, environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox', eventCallback(event) {
                    if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) { verifying.current = true; void check(true); }
                    if (event.name === CheckoutEventNames.CHECKOUT_ERROR || event.name === CheckoutEventNames.CHECKOUT_FAILED) setError('Checkout could not be completed. Your setup is saved; check payment status before retrying.');
                    if (event.name === CheckoutEventNames.CHECKOUT_PAYMENT_FAILED || event.name === CheckoutEventNames.CHECKOUT_PAYMENT_ERROR) setError('Your payment was declined. Try another card or payment method. You have not been charged and your setup is saved.');
                    if (event.name === CheckoutEventNames.CHECKOUT_CLOSED) setBusy(false);
                }
            });
            if (!paddle.current) throw new Error('Checkout could not be opened.');
            setStatus('AWAITING_PAYMENT');
            paddle.current.Checkout.open({ transactionId: id, settings: { displayMode: 'overlay', variant: 'one-page', theme: 'light', allowLogout: false, showAddDiscounts: false, successUrl: `${window.location.origin}/dashboard/sites/orders/${orderId}?paid=1` } });
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payment could not be started.'); }
        finally { setBusy(false); }
    }
    if (['CANCELED', 'EXPIRED'].includes(status)) return <Notice tone="info">This setup has ended. You can create a new site from Sites.</Notice>;
    return <div className="space-y-4">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {status === 'AWAITING_PAYMENT' && transactionId && !returning && !busy ? <Notice tone="info">Your payment is not finished yet. Resume it below and you will not be charged twice. If you already paid, choose Check payment status.</Notice> : null}
        {returning && status !== 'READY' && status !== 'CANCELED' && status !== 'EXPIRED' ? (slow
            ? <Notice tone="warning">Your payment is taking longer to confirm than usual. It is safe: you will not be charged twice, and your site starts as soon as the payment provider confirms. You can leave this page and check Subscription for the status, or contact support.</Notice>
            : <Notice tone="info">Thanks, we are confirming your payment. This page updates by itself and your site starts installing as soon as it is confirmed.</Notice>) : null}
        {status === 'READY' ? <Notice tone="info">{trial ? 'Trial approved.' : 'Payment confirmed.'} Your site is queued for provisioning. You will not be charged again.</Notice> : <>
            {CREDITS_ENABLED && !trial && !transactionId ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useCredits} disabled={busy} onChange={(event) => setUseCredits(event.target.checked)} />Use available account credits</label> : null}
            <Button type="button" disabled={busy} onClick={pay}>{busy ? 'Preparing…' : trial ? 'Start free trial' : covered ? 'Create my site' : status === 'AWAITING_PAYMENT' && transactionId ? 'Resume payment' : 'Continue to secure payment'}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { verifying.current = true; void check(true); }}>{covered ? 'Refresh' : 'Check payment status'}</Button>
        </>}
        {['DRAFT', 'AWAITING_PAYMENT'].includes(status) && <Button variant="ghost" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const result = await cancelSiteSetupAction(orderId); if (result.ok) { setStatus('CANCELED'); router.refresh(); } else setError(result.error); }
            finally { setBusy(false); }
        }}>Cancel this setup</Button>}
        {error ? <Notice tone="warning">{error}</Notice> : null}
    </div>;
}
