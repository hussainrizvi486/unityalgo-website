import 'server-only';
import { randomUUID } from 'node:crypto';
import { PaddleApiError } from '@/lib/paddle-catalog';

/** Only deliberately customer-safe checkout messages may cross a server action boundary. */
export class CheckoutError extends Error {
    constructor(message: string, public readonly reference?: string) {
        super(message);
        this.name = 'CheckoutError';
    }
}

/** Operator-facing causes for Paddle error codes, written to the log only: customers never see them. */
const PROVIDER_HINTS: Record<string, string> = {
    transaction_default_checkout_url_not_set: 'Set a Default payment link in Paddle: Checkout > Checkout settings.',
    forbidden: 'The API key lacks a permission, or it belongs to the other environment (sandbox key with NEXT_PUBLIC_PADDLE_ENV=production, or the reverse).',
    authentication_missing: 'PADDLE_API_KEY is empty or invalid for this environment.',
    customer_already_exists: 'Paddle already has a customer with this email and it could not be matched.',
    not_found: 'A Paddle id (usually Plan.paddlePriceId) does not exist in this environment. Sandbox and live ids differ.',
};

export function reportBillingFailure(error: unknown, context: { action: string; orderId?: string; operationId?: string; stage?: string }) {
    const reference = randomUUID();
    const object = error && typeof error === 'object' ? error as { code?: string; cause?: { code?: string; column?: string; table?: string } } : {};
    const rawCode = object.cause?.code ?? object.code;
    const databaseCode = typeof rawCode === 'string' && /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : undefined;
    const missingSchema = !!databaseCode && ['42703', '42P01', '42704'].includes(databaseCode);
    const provider = error instanceof PaddleApiError ? error : null;
    const missingKey = error instanceof Error && error.message === 'PADDLE_API_KEY is not set.';
    // Never log the original error object: database errors can contain SQL parameters.
    console.error('[billing] Payment setup failed', {
        reference, ...context,
        category: provider ? 'paddle' : missingSchema ? 'database_schema' : missingKey ? 'configuration' : 'internal',
        providerStatus: provider?.status, providerCode: provider?.code, providerRequestId: provider?.requestId,
        validationFields: provider?.validationFields,
        ...(provider?.code && PROVIDER_HINTS[provider.code] ? { hint: PROVIDER_HINTS[provider.code] } : {}),
        databaseCode, column: object.cause?.column, table: object.cause?.table,
        ...(missingSchema ? { recovery: 'Apply the committed database migrations from the website root.' } : {}),
    });
    const message = missingSchema
        ? 'Billing database setup is incomplete. Please contact support.'
        : missingKey || (provider && [401, 403].includes(provider.status))
            ? 'The payment service configuration needs attention. Please contact support.'
            : provider && [400, 404, 422].includes(provider.status)
                ? 'Paddle could not accept this checkout setup. Please contact support.'
                : 'The payment result needs to be checked. Please contact support before submitting another payment.';
    return { reference, message: `${message} Reference: ${reference}` };
}
