'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckoutEventNames, initializePaddle, type Paddle } from '@paddle/paddle-js';
import { checkoutSettlementAction, startPlanCheckoutAction } from '@/app/customer/actions';
import { Button } from '@/components/ui/button';
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

export function PlanCheckoutButton({ planId, label }: { planId: string; label: string }) {
    const router = useRouter();
    const [phase, setPhase] = React.useState<Phase>('idle');
    const [error, setError] = React.useState('');

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
                const { settled } = await checkoutSettlementAction(planId);
                if (cancelled.current) return;
                if (settled) {
                    setPhase('settled');
                    // Only now is there anything new for the page to show.
                    router.refresh();
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
    }, [planId, router]);

    async function open() {
        setError('');
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!token) {
            setError('Online payment is not configured yet. Please contact support.');
            return;
        }

        setPhase('opening');
        try {
            const intent = await startPlanCheckoutAction(planId);
            if (!intent.ok || !intent.priceId) {
                setError(intent.error ?? 'Could not start checkout.');
                setPhase('idle');
                return;
            }

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
                        setError('Checkout could not be completed. No payment was taken.');
                        setPhase('idle');
                        break;
                    default:
                        break;
                }
            };

            paddle.Checkout.open({
                items: [{ priceId: intent.priceId, quantity: 1 }],
                ...(intent.email ? { customer: { email: intent.email } } : {}),
                customData: intent.customData,
                settings: { displayMode: 'overlay', variant: 'one-page', theme: 'light', allowLogout: false },
            });
            setPhase('open');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not open checkout.');
            setPhase('idle');
        }
    }

    const busy = phase === 'opening' || phase === 'open' || phase === 'settling';

    return (
        <div>
            <Button
                type="button"
                onClick={open}
                disabled={busy || phase === 'settled'}
                className="w-full rounded-md"
            >
                {phase === 'opening' ? 'Opening checkout…'
                    : phase === 'settling' ? 'Activating your plan…'
                        : phase === 'settled' ? 'Plan active'
                            : label}
            </Button>

            {phase === 'settling' ? (
                <Notice tone="info" className="mt-2 portal-text-caption">
                    Payment received — activating your plan. This usually takes a few seconds.
                </Notice>
            ) : null}
            {phase === 'settled' ? (
                <Notice tone="success" className="mt-2 portal-text-caption">
                    Your plan is active.
                </Notice>
            ) : null}
            {phase === 'slow' ? (
                <Notice tone="warning" className="mt-2 portal-text-caption">
                    Your payment went through, but activation is taking longer than usual.
                    Nothing further is needed — refresh in a minute, and contact support if
                    it still has not appeared.
                </Notice>
            ) : null}
            {error ? (
                <Notice tone="error" className="mt-2 portal-text-caption">{error}</Notice>
            ) : null}
        </div>
    );
}
