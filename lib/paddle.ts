import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long a signed payload stays acceptable, in seconds. */
const MAX_SIGNATURE_AGE = 5 * 60;

export interface PaddleWebhookEvent {
    event_id: string;
    event_type: string;
    occurred_at?: string;
    data: Record<string, unknown>;
}

export function paddleWebhookSecret() {
    return process.env.PADDLE_WEBHOOK_SECRET ?? '';
}

function parseSignatureHeader(header: string) {
    let timestamp = '';
    let hash = '';
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1) continue;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key === 'ts') timestamp = value;
        else if (key === 'h1') hash = value;
    }
    return timestamp && hash ? { timestamp, hash } : null;
}

function hashesMatch(expected: string, received: string) {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string) {
    if (!secret || !signatureHeader) return false;

    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) return false;

    const sentAt = Number(parsed.timestamp);
    if (!Number.isFinite(sentAt)) return false;
    // Reject anything old enough to be a replay of a captured request.
    const age = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
    if (age > MAX_SIGNATURE_AGE) return false;

    const expected = createHmac('sha256', secret)
        .update(`${parsed.timestamp}:${rawBody}`)
        .digest('hex');

    return hashesMatch(expected, parsed.hash);
}

export const PADDLE_EVENTS = {
    /** Money settled. Grants or renews access and writes the invoice. */
    TRANSACTION_COMPLETED: 'transaction.completed',
    TRANSACTION_PAYMENT_FAILED: 'transaction.payment_failed',
    /** Paddle has given up retrying for now. */
    TRANSACTION_PAST_DUE: 'transaction.past_due',
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_PAUSED: 'subscription.paused',
    SUBSCRIPTION_RESUMED: 'subscription.resumed',
    SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
    /** A refund or credit against a transaction. */
    ADJUSTMENT_CREATED: 'adjustment.created',
    ADJUSTMENT_UPDATED: 'adjustment.updated',
} as const;

export const HANDLED_PADDLE_EVENTS: ReadonlySet<string> = new Set(
    Object.values(PADDLE_EVENTS),
);

/** Events that mean "this customer is not currently paying". */
const LAPSED_PADDLE_EVENTS: ReadonlySet<string> = new Set([
    PADDLE_EVENTS.TRANSACTION_PAYMENT_FAILED,
    PADDLE_EVENTS.TRANSACTION_PAST_DUE,
    PADDLE_EVENTS.SUBSCRIPTION_PAST_DUE,
    PADDLE_EVENTS.SUBSCRIPTION_PAUSED,
]);

function toSubscriptionStatus(paddleStatus: unknown) {
    switch (paddleStatus) {
        case 'active':
            return 'ACTIVE' as const;
        case 'trialing':
            return 'TRIAL' as const;
        case 'canceled':
            return 'CANCELED' as const;
        default:
            return 'PAST_DUE' as const;
    }
}

export function subscriptionStatusForEvent(eventType: string, data: Record<string, unknown>) {
    if (eventType === PADDLE_EVENTS.TRANSACTION_COMPLETED) return 'ACTIVE' as const;
    if (LAPSED_PADDLE_EVENTS.has(eventType)) return 'PAST_DUE' as const;
    if (eventType === PADDLE_EVENTS.SUBSCRIPTION_CANCELED) return 'CANCELED' as const;
    if (eventType === PADDLE_EVENTS.SUBSCRIPTION_RESUMED) return 'ACTIVE' as const;
    return toSubscriptionStatus(data.status);
}
