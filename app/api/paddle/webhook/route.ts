import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
    HANDLED_PADDLE_EVENTS,
    PADDLE_EVENTS,
    paddleWebhookSecret,
    subscriptionStatusForEvent,
    verifyPaddleSignature,
    type PaddleWebhookEvent,
} from '@/lib/paddle';

/**
 * Paddle's notification endpoint — the one place a subscription is granted.
 *
 * Nothing the browser reports is trusted: the customer's tab sees
 * `checkout.completed` before Paddle has finished settling, and a server action
 * behind it could be posted to directly by anyone holding a session. Access is
 * granted here, from a payload Paddle signed, or not at all.
 *
 * Point Paddle at POST /api/paddle/webhook (Paddle > Notifications) and put the
 * destination's secret in PADDLE_WEBHOOK_SECRET.
 *
 * Delivery state lives on the PaddleEvent row rather than in the shape of the
 * table: the row is claimed before any work, and only reaching PROCESSED stops
 * a retry being handled again. A handler that throws leaves a FAILED row with
 * its error, so a payment stuck behind a bug is visible instead of silently
 * dropped — which is what deleting the row used to do.
 */

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asDate(value: unknown): Date | null {
    const text = asString(value);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Paddle sends money as a minor-unit string ("4900" for $49.00). */
function fromMinorUnits(value: unknown): number | null {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount / 100 : null;
}

interface Target {
    userId: string;
    plan: { id: string; productId: string; name: string };
}

/**
 * Works out which customer and plan an event refers to.
 *
 * `custom_data` is attached when checkout opens and is echoed back by Paddle,
 * so it is the primary link. It is still verified against our own tables rather
 * than trusted: the ids travel through the browser, and a customer could edit
 * them before checkout opens. The price id is the fallback for events that
 * carry no custom data, such as an automatic renewal.
 *
 * Resolved once per delivery and threaded through the handlers — it used to be
 * recomputed by each of them, which meant a completed transaction ran the same
 * three lookups twice.
 */
async function resolveTarget(data: Record<string, unknown>): Promise<Target | null> {
    const custom = asRecord(data.custom_data);
    const userId = asString(custom.userId);
    const planId = asString(custom.planId);

    if (userId && planId) {
        const [user, plan] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
            prisma.plan.findUnique({
                where: { id: planId },
                select: { id: true, productId: true, name: true },
            }),
        ]);
        if (user && plan) return { userId: user.id, plan };
    }

    // Renewals arrive without custom data. Recover the plan from the price and
    // the customer from the Paddle subscription we already recorded.
    const items = Array.isArray(data.items) ? data.items : [];
    const priceId = items
        .map((item) => asString(asRecord(asRecord(item).price).id))
        .find(Boolean);

    const subscriptionId = asString(data.subscription_id) ?? asString(data.id);
    const [planByPrice, known] = await Promise.all([
        priceId
            ? prisma.plan.findUnique({
                where: { paddlePriceId: priceId },
                select: { id: true, productId: true, name: true },
            })
            : null,
        subscriptionId
            ? prisma.subscription.findUnique({
                where: { paddleSubscriptionId: subscriptionId },
                select: { userId: true, planId: true },
            })
            : null,
    ]);

    const plan =
        planByPrice
        ?? (known
            ? await prisma.plan.findUnique({
                where: { id: known.planId },
                select: { id: true, productId: true, name: true },
            })
            : null);

    const resolvedUser = userId ?? known?.userId ?? null;
    if (!plan || !resolvedUser) return null;
    return { userId: resolvedUser, plan };
}

/** Grants or updates the subscription an event describes. */
async function applySubscription(
    tx: Prisma.TransactionClient,
    event: PaddleWebhookEvent,
    target: Target,
) {
    const data = event.data;
    const { userId, plan } = target;
    const paddleSubscriptionId = asString(data.subscription_id) ?? asString(data.id);
    const paddleCustomerId = asString(data.customer_id);
    const status = subscriptionStatusForEvent(event.event_type, data);

    // The two event families name this differently: subscription.* sends
    // `current_billing_period`, transaction.completed sends `billing_period`.
    // Reading only the first left a freshly purchased subscription showing
    // whatever renewal date it had before, or none at all.
    const currentPeriodEnd =
        asDate(asRecord(data.current_billing_period).ends_at)
        ?? asDate(asRecord(data.billing_period).ends_at);

    const canceled = status === 'CANCELED';
    // Paddle reports a scheduled cancellation as `scheduled_change` while the
    // subscription is still active. Cancelling is not the same as losing the
    // rest of a period already paid for, so this only records the intent.
    const scheduledAction = asString(asRecord(data.scheduled_change).action);
    const cancelAtPeriodEnd = canceled ? false : scheduledAction === 'cancel';

    const cancellation = canceled
        ? {
            canceledAt: asDate(data.canceled_at) ?? new Date(),
            cancelAtPeriodEnd: false,
        }
        : { cancelAtPeriodEnd, ...(scheduledAction ? {} : { canceledAt: null }) };

    await tx.subscription.upsert({
        // One subscription per customer per product, which is the existing
        // rule — buying a second AlgoSuite plan replaces the first.
        where: { userId_productId: { userId, productId: plan.productId } },
        update: {
            planId: plan.id,
            status,
            ...cancellation,
            ...(paddleSubscriptionId ? { paddleSubscriptionId } : {}),
            ...(paddleCustomerId ? { paddleCustomerId } : {}),
            ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        },
        create: {
            userId,
            planId: plan.id,
            productId: plan.productId,
            status,
            paddleSubscriptionId,
            paddleCustomerId,
            currentPeriodEnd,
            canceledAt: canceled ? new Date() : null,
            cancelAtPeriodEnd,
        },
    });
}

/** Records the payment behind a completed transaction. */
async function recordBilling(
    tx: Prisma.TransactionClient,
    event: PaddleWebhookEvent,
    target: Target,
) {
    const data = event.data;
    const transactionId = asString(data.id);
    if (!transactionId) return;

    const details = asRecord(data.details);
    const totals = asRecord(details.totals);
    const amount = fromMinorUnits(totals.grand_total) ?? 0;

    const subscription = await tx.subscription.findUnique({
        where: { userId_productId: { userId: target.userId, productId: target.plan.productId } },
        select: { id: true },
    });

    const period = asRecord(data.billing_period);
    const paidAt = asDate(data.billed_at) ?? new Date();

    await tx.billingRecord.upsert({
        // The invoice number is unique, and deriving it from Paddle's
        // transaction id is what keeps a retried delivery from writing a
        // second invoice for one payment.
        where: { invoiceNumber: transactionId },
        update: { status: 'PAID', amount, paidAt },
        create: {
            userId: target.userId,
            subscriptionId: subscription?.id ?? null,
            invoiceNumber: transactionId,
            description: `${target.plan.name} plan`,
            amount,
            currency: asString(totals.currency_code)
                ?? asString(details.currency_code)
                ?? asString(data.currency_code)
                ?? 'USD',
            status: 'PAID',
            periodStart: asDate(period.starts_at),
            periodEnd: asDate(period.ends_at),
            issuedAt: new Date(),
            paidAt,
            paymentMethod: 'Paddle',
            paymentReference: transactionId,
        },
    });
}

/**
 * Marks the invoice behind a failed charge overdue.
 *
 * A declined renewal previously wrote nothing at all, so the customer's
 * billing history showed the last successful payment and then silence. The
 * invoice is created if this is the first anyone has heard of the transaction
 * — Paddle raises the transaction before it charges.
 */
async function recordFailedPayment(
    tx: Prisma.TransactionClient,
    event: PaddleWebhookEvent,
    target: Target,
) {
    const data = event.data;
    const transactionId = asString(data.id);
    if (!transactionId) return;

    const details = asRecord(data.details);
    const totals = asRecord(details.totals);
    const amount = fromMinorUnits(totals.grand_total) ?? 0;
    const period = asRecord(data.billing_period);

    const subscription = await tx.subscription.findUnique({
        where: { userId_productId: { userId: target.userId, productId: target.plan.productId } },
        select: { id: true },
    });

    await tx.billingRecord.upsert({
        where: { invoiceNumber: transactionId },
        // Never downgrade a payment that already settled: a `payment_failed`
        // for one attempt can arrive after a later attempt succeeded.
        update: { status: 'OVERDUE', notes: 'Payment attempt declined by the provider.' },
        create: {
            userId: target.userId,
            subscriptionId: subscription?.id ?? null,
            invoiceNumber: transactionId,
            description: `${target.plan.name} plan`,
            amount,
            currency: asString(totals.currency_code) ?? asString(details.currency_code) ?? 'USD',
            status: 'OVERDUE',
            periodStart: asDate(period.starts_at),
            periodEnd: asDate(period.ends_at),
            issuedAt: new Date(),
            paymentMethod: 'Paddle',
            paymentReference: transactionId,
            notes: 'Payment attempt declined by the provider.',
        },
    });
}

/**
 * Applies a refund or credit to the invoice it reverses.
 *
 * Adjustments name their transaction, so this needs no target resolution —
 * and must not invent an invoice: an adjustment against a transaction we never
 * recorded is nothing this app can act on.
 */
async function recordAdjustment(tx: Prisma.TransactionClient, event: PaddleWebhookEvent) {
    const data = event.data;
    const transactionId = asString(data.transaction_id);
    if (!transactionId) return;

    const existing = await tx.billingRecord.findUnique({
        where: { invoiceNumber: transactionId },
        select: { id: true, amount: true },
    });
    if (!existing) return;

    const totals = asRecord(data.totals);
    const refunded = fromMinorUnits(totals.total) ?? 0;
    const action = asString(data.action);

    // Only a refund reverses money. A `credit` adjustment offsets a future
    // invoice and leaves this one paid.
    if (action !== 'refund') return;

    // Partial refunds keep the invoice PAID: the customer did pay, just less.
    const fullyRefunded = refunded >= existing.amount - 0.005;

    await tx.billingRecord.update({
        where: { id: existing.id },
        data: {
            status: fullyRefunded ? 'REFUNDED' : 'PAID',
            refundedAt: asDate(data.created_at) ?? new Date(),
            refundedAmount: refunded,
        },
    });
}

export async function POST(request: Request) {
    // The exact received bytes, read before anything else: re-serializing
    // parsed JSON changes key order and whitespace, and with it the hash.
    const rawBody = await request.text();
    const signature = request.headers.get('paddle-signature');

    const secret = paddleWebhookSecret();
    if (!secret) {
        // Refuse rather than accept unverified events. An endpoint that grants
        // subscriptions must never be reachable without its secret configured.
        console.error('[paddle] PADDLE_WEBHOOK_SECRET is not set; rejecting webhook');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    if (!verifyPaddleSignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: PaddleWebhookEvent;
    try {
        event = JSON.parse(rawBody) as PaddleWebhookEvent;
    } catch {
        return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
    }
    if (!event?.event_id || !event?.event_type) {
        return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
    }

    const handled = HANDLED_PADDLE_EVENTS.has(event.event_type);
    const payload = JSON.parse(rawBody) as Prisma.InputJsonValue;

    // Claim the delivery before doing any work. Paddle retries until it gets a
    // 2xx, so the same event id arrives repeatedly. `attempts` counts those
    // deliveries; only a PROCESSED row short-circuits one.
    let claim;
    try {
        claim = await prisma.paddleEvent.upsert({
            where: { id: event.event_id },
            update: { attempts: { increment: 1 } },
            create: {
                id: event.event_id,
                eventType: event.event_type,
                payload,
                status: handled ? 'PENDING' : 'IGNORED',
                attempts: 1,
                ...(handled ? {} : { processedAt: new Date() }),
            },
            select: { status: true, attempts: true },
        });
    } catch (error) {
        // Logged and answered rather than thrown: an unhandled throw returns
        // an empty 500 that says nothing about a payment that may have
        // succeeded.
        console.error('[paddle] could not record event', event.event_id, error);
        return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
    }

    if (!handled) {
        // Recorded above, which is the point — unhandled types stay auditable.
        // Checked before the duplicate test so the first delivery of an
        // unrelated event reports what actually happened to it.
        return NextResponse.json({ ok: true, ignored: true });
    }

    if (claim.status === 'PROCESSED') {
        // Already settled. Acknowledge so Paddle stops retrying.
        return NextResponse.json({ ok: true, duplicate: true });
    }

    // A row left IGNORED by an earlier deploy, for an event type this build
    // now handles, is deliberately allowed through rather than skipped.

    try {
        const target =
            event.event_type === PADDLE_EVENTS.ADJUSTMENT_CREATED
            || event.event_type === PADDLE_EVENTS.ADJUSTMENT_UPDATED
                ? null
                : await resolveTarget(event.data);

        // One transaction: a granted subscription with no invoice behind it,
        // or an invoice for access nobody got, are both worse than retrying
        // the pair.
        await prisma.$transaction(async (tx) => {
            switch (event.event_type) {
                case PADDLE_EVENTS.ADJUSTMENT_CREATED:
                case PADDLE_EVENTS.ADJUSTMENT_UPDATED:
                    await recordAdjustment(tx, event);
                    return;
                case PADDLE_EVENTS.TRANSACTION_COMPLETED:
                    if (!target) return;
                    await applySubscription(tx, event, target);
                    await recordBilling(tx, event, target);
                    return;
                case PADDLE_EVENTS.TRANSACTION_PAYMENT_FAILED:
                case PADDLE_EVENTS.TRANSACTION_PAST_DUE:
                    if (!target) return;
                    await applySubscription(tx, event, target);
                    await recordFailedPayment(tx, event, target);
                    return;
                default:
                    if (!target) return;
                    await applySubscription(tx, event, target);
            }
        });

        await prisma.paddleEvent.update({
            where: { id: event.event_id },
            data: { status: 'PROCESSED', processedAt: new Date(), error: null },
        });
    } catch (error) {
        // The row stays, carrying why. Paddle's retry finds it PENDING/FAILED
        // and is allowed to run the handler again; deleting it, as this used
        // to, destroyed the only evidence the delivery ever arrived.
        const message = error instanceof Error ? error.message : String(error);
        await prisma.paddleEvent
            .update({
                where: { id: event.event_id },
                data: { status: 'FAILED', error: message.slice(0, 1000) },
            })
            .catch(() => {});
        console.error('[paddle] failed to handle', event.event_type, error);
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
