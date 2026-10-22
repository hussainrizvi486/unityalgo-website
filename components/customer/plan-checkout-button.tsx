'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckoutEventNames, initializePaddle, type Paddle } from '@paddle/paddle-js';
import { checkoutSettlementAction, startPlanCheckoutAction, confirmPlanChangeAction, cancelPendingCheckoutAction, cancelPlanChangeQuoteAction } from '@/app/customer/actions';
import { Button } from '@/components/ui/button';
import { currencyDigits } from '@/lib/billing-rules';
import { Notice } from '@/components/ui/notice';

/** Paddle.js is a singleton — initialising twice leaks a second instance. */
let paddlePromise: Promise<Paddle | undefined> | null = null;

let activeCallback: ((event: { name?: string }) => void) | null = null;

function getPaddle(token: string) {
    paddlePromise ??= initializePaddle({
        token,
        environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
        eventCallback: (event) => activeCallback?.(event),
    });
    return paddlePromise;
}

/** How long to wait for the webhook before telling the customer to check back. */
const SETTLE_ATTEMPTS = 20;
const SETTLE_INTERVAL_MS = 1500;

type Phase = 'idle' | 'opening' | 'open' | 'settling' | 'settled' | 'slow';

export function PlanCheckoutButton({ planId, label, siteId, onSettled }: { planId: string; label: string; siteId?: string; onSettled?: () => void }) {
    const router = useRouter();
    const [phase, setPhase] = React.useState<Phase>('idle');
    const [error, setError] = React.useState('');
    const [useCredits, setUseCredits] = React.useState(true);
    const [pendingCheckout, setPendingCheckout] = React.useState(false);
    const [quote, setQuote] = React.useState<{ operationId: string; amount: string; currency: string; action: string; creditsApplied: number } | null>(null);

    const cancelled = React.useRef(false);
    React.useEffect(() => {
        cancelled.current = false;
        return () => {
            cancelled.current = true;
            activeCallback = null;
        };
    }, []);

    const waitForWebhook = React.useCallback(async () => {
        setPhase('settling');
        for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
            if (cancelled.current) return;
            try {
                const { settled } = await checkoutSettlementAction(planId, siteId);
                if (cancelled.current) return;
                if (settled) {
                    setPhase('settled');
                    // Only now is there anything new for the page to show.
                    router.refresh();
                    onSettled?.();
                    return;
                }
            } catch {
            }
            await new Promise((resolve) => setTimeout(resolve, SETTLE_INTERVAL_MS));
        }
        if (!cancelled.current) {
            setPhase('slow');
            router.refresh();
        }
    }, [planId, siteId, router, onSettled]);

    async function open() {
        setError('');
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!token) {
            setError('Online payment is not configured yet. Please contact support.');
            return;
        }

        setPhase('opening');
        try {
            const intent = await startPlanCheckoutAction(planId, useCredits, siteId);
            if (!intent.ok) {
                setError(intent.error ?? 'Could not start checkout.');
                setPendingCheckout(Boolean(intent.pendingCheckout));
                setPhase('idle');
                return;
            }

            if (intent.change) {
                setQuote(intent.change);
                setPhase('idle');
                return;
            }
            if (!intent.transactionId) throw new Error('No checkout transaction was returned.');
            const paddle = await getPaddle(token);
            if (!paddle) throw new Error('Paddle.js did not initialise.');

            activeCallback = (event) => {
                switch (event.name) {
                    case CheckoutEventNames.CHECKOUT_COMPLETED:
                        void waitForWebhook();
                        break;
                    case CheckoutEventNames.CHECKOUT_CLOSED:
                        setPhase((current) => (current === 'open' ? 'idle' : current));
                        break;
                    case CheckoutEventNames.CHECKOUT_ERROR:
                        setError('Checkout could not be completed. Check billing history before retrying.');
                        setPhase('idle');
                        break;
                    default:
                        break;
                }
            };

            paddle.Checkout.open({
                transactionId: intent.transactionId,
                settings: { displayMode: 'overlay', variant: 'one-page', theme: 'light', allowLogout: false, showAddDiscounts: false },
            });
            setPhase('open');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not open checkout.');
            setPhase('idle');
        }
    }

    async function confirm() {
        if (!quote) return;
        setError('');
        setPhase('opening');
        try {
            const result = await confirmPlanChangeAction(quote.operationId);
            if (!result.ok) throw new Error(result.error);
            setQuote(null);
            await waitForWebhook();
        } catch (cause) {
            setQuote(null);
            setError(cause instanceof Error ? cause.message : 'Could not change plan.');
            setPhase('idle');
        }
    }

    const busy = phase === 'opening' || phase === 'open' || phase === 'settling';

    return (
        <div>
            {!quote ? <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useCredits} disabled={busy} onChange={(event) => setUseCredits(event.target.checked)} />
                Use available account credits
            </label> : null}
            <Button
                type="button"
                onClick={quote ? confirm : open}
                disabled={busy || phase === 'settled'}
                className="w-full rounded-md"
            >
                {phase === 'opening' ? 'Opening checkout…'
                    : phase === 'settling' ? 'Activating your plan…'
                        : phase === 'settled' ? 'Plan active'
                            : quote ? 'Confirm plan change' : label}
            </Button>

            {quote ? (
                <Notice tone="info" className="mt-2 portal-text-caption">
                    {quote.action === 'credit' ? 'Prorated credit' : 'Estimated amount due now'}:{' '}
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency }).format(Number(quote.amount) / 10 ** currencyDigits(quote.currency))}.
                    {quote.creditsApplied > 0 ? <> Includes {new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency }).format(quote.creditsApplied / 10 ** currencyDigits(quote.currency))} in account credits applied as an invoice discount.</> : null}
                    {' '}This change takes effect immediately. Paddle calculates the final amount when confirmed.
                    <button type="button" className="ml-2 underline" disabled={busy} onClick={async () => {
                        setPhase('opening');
                        try {
                            const result = await cancelPlanChangeQuoteAction(quote.operationId);
                            if (!result.ok) throw new Error(result.error);
                            setQuote(null);
                        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Credits are being returned.'); }
                        finally { setPhase('idle'); }
                    }}>Cancel</button>
                </Notice>
            ) : null}
            {phase === 'settling' ? (
                <Notice tone="info" className="mt-2 portal-text-caption">
                    Confirming your subscription — activating your plan. This usually takes a few seconds.
                </Notice>
            ) : null}
            {phase === 'settled' ? (
                <Notice tone="success" className="mt-2 portal-text-caption">
                    Your plan is active.
                </Notice>
            ) : null}
            {phase === 'slow' ? (
                <Notice tone="warning" className="mt-2 portal-text-caption">
                    Your billing request is still being synchronized.
                    Nothing further is needed — refresh in a minute, and contact support if
                    it still has not appeared.
                </Notice>
            ) : null}
            {pendingCheckout ? <Button type="button" variant="outline" className="mt-2" disabled={busy} onClick={async () => {
                setPhase('opening');
                try {
                    const result = await cancelPendingCheckoutAction(planId);
                    if (!result.ok) throw new Error(result.error);
                    setPendingCheckout(false); setError('');
                } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not cancel checkout.'); }
                finally { setPhase('idle'); }
            }}>Cancel unfinished checkout</Button> : null}
            {error ? (
                <Notice tone="error" className="mt-2 portal-text-caption">{error}</Notice>
            ) : null}
        </div>
    );
}
