import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Server-side Paddle helpers.
 *
 * The only thing in this app permitted to grant a paid subscription is a
 * webhook that has passed `verifyPaddleSignature` below. A browser reporting
 * `checkout.completed` is not evidence of anything — that event fires in the
 * customer's own tab, and the server action behind it can be called directly
 * by anyone with a session. Payment is whatever Paddle signs for.
 *
 * Verification is done against `node:crypto` rather than @paddle/paddle-node-sdk
 * to avoid pulling a second Paddle package in for one HMAC; the scheme is
 * fixed and small. If more of the Paddle API gets used server-side later
 * (refunds, plan changes, invoice retrieval) the SDK starts paying for itself
 * and this should move over.
 */

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

/** Whether checkout can run at all — used to render an honest disabled state. */
export function paddleIsConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
}

/**
 * Parses Paddle's `Paddle-Signature` header.
 *
 * Format is `ts=<unix seconds>;h1=<hex hmac>`. Both parts are required: the
 * timestamp is part of the signed material, so it cannot be tampered with, and
 * checking its age is what stops a captured request being replayed forever.
 */
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
    // timingSafeEqual throws on unequal lengths, so length has to be checked
    // first. That leaks nothing useful: a hex SHA-256 digest is always 64
    // characters, so a mismatch only says the input was the wrong shape.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * Whether `rawBody` really came from Paddle.
 *
 * `rawBody` has to be the exact bytes received. Parsing to JSON and
 * re-serializing changes key order and whitespace, which changes the hash —
 * the route reads `request.text()` before it reads anything else for this
 * reason.
 */
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

/**
 * The events this app acts on, and what each one means here.
 *
 * Kept beside the status mapping rather than in the route so the two cannot
 * disagree about which events are expected. Anything not listed is still
 * recorded and acknowledged — an unhandled type is auditable, not an error.
 */
export const PADDLE_EVENTS = {
    /** Money settled. Grants or renews access and writes the invoice. */
    TRANSACTION_COMPLETED: 'transaction.completed',
    /** A charge was declined. The subscription is not cancelled — Paddle will
     *  retry on its own dunning schedule — but access must stop meanwhile. */
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
export const LAPSED_PADDLE_EVENTS: ReadonlySet<string> = new Set([
    PADDLE_EVENTS.TRANSACTION_PAYMENT_FAILED,
    PADDLE_EVENTS.TRANSACTION_PAST_DUE,
    PADDLE_EVENTS.SUBSCRIPTION_PAST_DUE,
    PADDLE_EVENTS.SUBSCRIPTION_PAUSED,
]);

/**
 * Maps a Paddle subscription status onto ours.
 *
 * Paddle's `trialing` is our TRIAL, and both `past_due` and `paused` mean the
 * customer is not currently paying — they map to PAST_DUE so access checks
 * treat them as lapsed. An unrecognised status is treated as past due rather
 * than active: the failure that leaves someone unpaid but served is worse than
 * the one that asks them to check their billing.
 */
export function toSubscriptionStatus(paddleStatus: unknown) {
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

/**
 * The subscription status an event implies, which is not always the status in
 * its payload.
 *
 * A failed charge is the case that used to be missed entirely: Paddle sends
 * `transaction.payment_failed` while keeping the subscription `active` on its
 * side during dunning, so mapping the payload's own status would leave a
 * non-paying customer fully served until they cancelled.
 */
export function subscriptionStatusForEvent(eventType: string, data: Record<string, unknown>) {
    if (eventType === PADDLE_EVENTS.TRANSACTION_COMPLETED) return 'ACTIVE' as const;
    if (LAPSED_PADDLE_EVENTS.has(eventType)) return 'PAST_DUE' as const;
    if (eventType === PADDLE_EVENTS.SUBSCRIPTION_CANCELED) return 'CANCELED' as const;
    if (eventType === PADDLE_EVENTS.SUBSCRIPTION_RESUMED) return 'ACTIVE' as const;
    return toSubscriptionStatus(data.status);
}
