import { NextResponse } from 'next/server';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { asDate, asRecord, asString, fromMinorUnits } from '@/lib/paddle-data';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import {
    HANDLED_PADDLE_EVENTS,
    PADDLE_EVENTS,
    paddleWebhookSecret,
    subscriptionStatusForEvent,
    verifyPaddleSignature,
    type PaddleWebhookEvent,
} from '@/lib/paddle';

interface Target {
    userId: string;
    plan: { id: string; productId: string; name: string };
}

async function resolveTarget(data: Record<string, unknown>): Promise<Target | null> {
    const custom = asRecord(data.custom_data);
    const userId = asString(custom.userId);
    const planId = asString(custom.planId);

    if (userId && planId) {
        const [user, plan] = await Promise.all([
            db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { id: true } }),
            db.query.plan.findFirst({
                where: eq(schema.plan.id, planId),
                columns: { id: true, productId: true, name: true },
            }),
        ]);
        if (user && plan) return { userId: user.id, plan };
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const priceIds = items
        .map((item) => asString(asRecord(asRecord(item).price).id))
        .filter((id): id is string => Boolean(id));

    const subscriptionId = asString(data.subscription_id) ?? asString(data.id);
    const [planByPrice, known] = await Promise.all([
        priceIds.length
            ? db.query.plan.findFirst({
                where: inArray(schema.plan.paddlePriceId, priceIds),
                columns: { id: true, productId: true, name: true },
            })
            : null,
        subscriptionId
            ? db.query.subscription.findFirst({
                where: eq(schema.subscription.paddleSubscriptionId, subscriptionId),
                columns: { userId: true, planId: true },
            })
            : null,
    ]);

    const plan =
        planByPrice
        ?? (known
            ? await db.query.plan.findFirst({
                where: eq(schema.plan.id, known.planId),
                columns: { id: true, productId: true, name: true },
            })
            : null);

    const resolvedUser = userId ?? known?.userId ?? null;
    if (!plan || !resolvedUser) return null;
    return { userId: resolvedUser, plan };
}

/** Grants or updates the subscription an event describes. */
async function applySubscription(
    tx: Tx,
    event: PaddleWebhookEvent,
    target: Target,
) {
    const data = event.data;
    const { userId, plan } = target;
    const paddleSubscriptionId = asString(data.subscription_id) ?? asString(data.id);
    const paddleCustomerId = asString(data.customer_id);
    const status = subscriptionStatusForEvent(event.event_type, data);

    const currentPeriodEnd =
        asDate(asRecord(data.current_billing_period).ends_at)
        ?? asDate(asRecord(data.billing_period).ends_at);

    const canceled = status === 'CANCELED';
    const scheduledAction = asString(asRecord(data.scheduled_change).action);
    const cancelAtPeriodEnd = canceled ? false : scheduledAction === 'cancel';

    const cancellation = canceled
        ? {
            canceledAt: asDate(data.canceled_at) ?? new Date(),
            cancelAtPeriodEnd: false,
        }
        : { cancelAtPeriodEnd, ...(scheduledAction ? {} : { canceledAt: null }) };

    await tx
        .insert(schema.subscription)
        .values({
            userId,
            planId: plan.id,
            productId: plan.productId,
            status,
            paddleSubscriptionId,
            paddleCustomerId,
            currentPeriodEnd,
            canceledAt: canceled ? new Date() : null,
            cancelAtPeriodEnd,
        })
        .onConflictDoUpdate({
            target: [schema.subscription.userId, schema.subscription.productId],
            set: {
                planId: plan.id,
                status,
                ...cancellation,
                ...(paddleSubscriptionId ? { paddleSubscriptionId } : {}),
                ...(paddleCustomerId ? { paddleCustomerId } : {}),
                ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
            },
        });
}

/** What a payment was for: the plan, plus any paid apps on the same invoice. */
async function describeCharge(data: Record<string, unknown>, planName: string) {
    const priceIds = (Array.isArray(data.items) ? data.items : [])
        .map((item) => asString(asRecord(asRecord(item).price).id))
        .filter((id): id is string => Boolean(id));
    const apps = priceIds.length
        ? await db.query.appCatalog.findMany({ where: inArray(schema.appCatalog.paddlePriceId, priceIds), columns: { name: true } })
        : [];
    const planCharged = priceIds.length === 0 || (await db.query.plan.findFirst({ where: inArray(schema.plan.paddlePriceId, priceIds), columns: { id: true } })) !== undefined;
    const appText = apps.map((app) => app.name).join(', ');
    if (!apps.length) return `${planName} plan`;
    return planCharged ? `${planName} plan + apps: ${appText}` : `Apps: ${appText}`;
}

/** Records the payment behind a completed transaction. */
async function recordBilling(
    tx: Tx,
    event: PaddleWebhookEvent,
    target: Target,
) {
    const data = event.data;
    const transactionId = asString(data.id);
    if (!transactionId) return;

    const details = asRecord(data.details);
    const totals = asRecord(details.totals);
    const amount = fromMinorUnits(totals.grand_total) ?? 0;

    const subscription = await tx.query.subscription.findFirst({
        where: and(eq(schema.subscription.userId, target.userId), eq(schema.subscription.productId, target.plan.productId)),
        columns: { id: true },
    });

    const period = asRecord(data.billing_period);
    const paidAt = asDate(data.billed_at) ?? new Date();

    await tx
        .insert(schema.billingRecord)
        .values({
            userId: target.userId,
            subscriptionId: subscription?.id ?? null,
            invoiceNumber: transactionId,
            description: await describeCharge(data, target.plan.name),
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
        })
        .onConflictDoUpdate({
            target: schema.billingRecord.invoiceNumber,
            set: { status: 'PAID', amount, paidAt },
        });
}

async function recordFailedPayment(
    tx: Tx,
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

    const subscription = await tx.query.subscription.findFirst({
        where: and(eq(schema.subscription.userId, target.userId), eq(schema.subscription.productId, target.plan.productId)),
        columns: { id: true },
    });

    await tx
        .insert(schema.billingRecord)
        .values({
            userId: target.userId,
            subscriptionId: subscription?.id ?? null,
            invoiceNumber: transactionId,
            description: await describeCharge(data, target.plan.name),
            amount,
            currency: asString(totals.currency_code) ?? asString(details.currency_code) ?? 'USD',
            status: 'OVERDUE',
            periodStart: asDate(period.starts_at),
            periodEnd: asDate(period.ends_at),
            issuedAt: new Date(),
            paymentMethod: 'Paddle',
            paymentReference: transactionId,
            notes: 'Payment attempt declined by the provider.',
        })
        .onConflictDoUpdate({
            target: schema.billingRecord.invoiceNumber,
            set: { status: 'OVERDUE', notes: 'Payment attempt declined by the provider.' },
            setWhere: notInArray(schema.billingRecord.status, ['PAID', 'REFUNDED']),
        });
}

async function recordAdjustment(tx: Tx, event: PaddleWebhookEvent) {
    const data = event.data;
    const transactionId = asString(data.transaction_id);
    if (!transactionId) return;

    const existing = await tx.query.billingRecord.findFirst({
        where: eq(schema.billingRecord.invoiceNumber, transactionId),
        columns: { id: true, amount: true },
    });
    if (!existing) return;

    const totals = asRecord(data.totals);
    const refunded = fromMinorUnits(totals.total) ?? 0;
    const action = asString(data.action);

    if (action !== 'refund') return;

    // Partial refunds keep the invoice PAID: the customer did pay, just less.
    const fullyRefunded = refunded >= existing.amount - 0.005;

    await tx
        .update(schema.billingRecord)
        .set({
            status: fullyRefunded ? 'REFUNDED' : 'PAID',
            refundedAt: asDate(data.created_at) ?? new Date(),
            refundedAmount: refunded,
        })
        .where(eq(schema.billingRecord.id, existing.id));
}

export async function POST(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get('paddle-signature');

    const secret = paddleWebhookSecret();
    if (!secret) {
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
    const payload: unknown = JSON.parse(rawBody);

    let claim: { status: 'PENDING' | 'PROCESSED' | 'IGNORED' | 'FAILED'; attempts: number };
    try {
        [claim] = await db
            .insert(schema.paddleEvent)
            .values({
                id: event.event_id,
                eventType: event.event_type,
                payload,
                status: handled ? 'PENDING' : 'IGNORED',
                attempts: 1,
                ...(handled ? {} : { processedAt: new Date() }),
            })
            .onConflictDoUpdate({
                target: schema.paddleEvent.id,
                set: { attempts: sql`${schema.paddleEvent.attempts} + 1` },
            })
            .returning({ status: schema.paddleEvent.status, attempts: schema.paddleEvent.attempts });
    } catch (error) {
        console.error('[paddle] could not record event', event.event_id, error);
        return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
    }

    if (!handled) {
        return NextResponse.json({ ok: true, ignored: true });
    }

    if (claim.status === 'PROCESSED') {
        // Already settled. Acknowledge so Paddle stops retrying.
        return NextResponse.json({ ok: true, duplicate: true });
    }

    try {
        const target =
            event.event_type === PADDLE_EVENTS.ADJUSTMENT_CREATED
            || event.event_type === PADDLE_EVENTS.ADJUSTMENT_UPDATED
                ? null
                : await resolveTarget(event.data);

        await db.transaction(async (tx) => {
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

        await db
            .update(schema.paddleEvent)
            .set({ status: 'PROCESSED', processedAt: new Date(), error: null })
            .where(eq(schema.paddleEvent.id, event.event_id));

        if (target) {
            const held = await db.query.subscription.findFirst({
                where: and(eq(schema.subscription.userId, target.userId), eq(schema.subscription.planId, target.plan.id), eq(schema.subscription.status, 'ACTIVE')),
                columns: { id: true },
            });
            if (held) await controller.sites.convertTrials(target.userId, target.plan.id).catch(() => undefined);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db
            .update(schema.paddleEvent)
            .set({ status: 'FAILED', error: message.slice(0, 1000) })
            .where(eq(schema.paddleEvent.id, event.event_id))
            .catch(() => {});
        console.error('[paddle] failed to handle', event.event_type, error);
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
