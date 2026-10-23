/** Pure presentation rules for a customer's subscription: its state, the sentence shown, and what they may do. */

export type SubscriptionState = 'active' | 'trial' | 'cancelling' | 'past_due' | 'paused' | 'canceled' | 'renewing';
export type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export interface SubscriptionInput {
    status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED' | 'PAUSED';
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
    graceEndsAt: Date | null;
    canceledAt: Date | null;
    billedOnline: boolean;
    planName: string;
    /** Already formatted, e.g. "PKR 5,700/month". */
    price: string;
    /** Already formatted, e.g. "100% off". */
    discount: string | null;
    /** The site is gone or never created, so the subscription can run a new one. */
    idle: boolean;
    now?: Date;
}

export interface SubscriptionView {
    state: SubscriptionState;
    label: string;
    tone: Tone;
    message: string;
    canUpgrade: boolean;
    canCancel: boolean;
    canResume: boolean;
    canUpdatePayment: boolean;
    /** A paid subscription with no site: offer to create one. */
    canCreateSite: boolean;
}

const day = (date: Date) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);

export function describeSubscription(input: SubscriptionInput): SubscriptionView {
    const now = input.now ?? new Date();
    const end = input.currentPeriodEnd ? day(input.currentPeriodEnd) : null;
    const live = input.status === 'ACTIVE' || input.status === 'PAST_DUE' || input.status === 'TRIAL';
    const base = {
        canUpgrade: input.billedOnline && input.status === 'ACTIVE' && !input.cancelAtPeriodEnd,
        canCancel: input.billedOnline && (input.status === 'ACTIVE' || input.status === 'PAST_DUE') && !input.cancelAtPeriodEnd,
        canResume: input.billedOnline && input.status === 'ACTIVE' && input.cancelAtPeriodEnd,
        canUpdatePayment: input.billedOnline && live,
        canCreateSite: input.idle && input.status === 'ACTIVE',
    };

    if (input.status === 'CANCELED') {
        return { ...base, state: 'canceled', label: 'Canceled', tone: 'neutral', canUpgrade: false, canCancel: false, canResume: false, canCreateSite: false,
            message: input.canceledAt ? `This subscription ended on ${day(input.canceledAt)}.` : end ? `This subscription ended on ${end}.` : 'This subscription has ended.' };
    }
    if (input.status === 'PAUSED') {
        return { ...base, state: 'paused', label: 'Paused', tone: 'warning', canUpgrade: false,
            message: 'This subscription is paused, so its site is switched off. Contact support to resume it.' };
    }
    if (input.status === 'PAST_DUE') {
        const grace = input.graceEndsAt ? ` Update your payment method by ${day(input.graceEndsAt)} to keep your site running.` : ' Update your payment method to keep your site running.';
        return { ...base, state: 'past_due', label: 'Payment failed', tone: 'error', canUpgrade: false, message: `We could not collect your last payment.${grace}` };
    }
    if (input.status === 'TRIAL') {
        return { ...base, state: 'trial', label: 'Free trial', tone: 'info', message: end ? `Your free trial of ${input.planName} runs until ${end}.` : `You are on a free trial of ${input.planName}.` };
    }
    if (input.cancelAtPeriodEnd) {
        return { ...base, state: 'cancelling', label: end ? `Ends ${end}` : 'Canceling', tone: 'warning', canCreateSite: false,
            message: end ? `Your ${input.planName} plan is canceled. You can keep using it until ${end}, and it will not renew.` : `Your ${input.planName} plan is canceled and will not renew.` };
    }
    // The period ended more than a day ago and Paddle has not confirmed the renewal yet.
    if (input.currentPeriodEnd && input.currentPeriodEnd.getTime() < now.getTime() - 86_400_000) {
        return { ...base, state: 'renewing', label: 'Confirming renewal', tone: 'info', canUpgrade: false,
            message: 'We are waiting for your payment provider to confirm your latest renewal. This usually takes a few minutes.' };
    }
    const renews = end ? ` Your plan renews at ${input.price} on ${end}.` : '';
    const message = input.discount
        ? `You've got ${input.discount} ${input.planName}.${renews}`
        : `Your ${input.planName} plan is active.${renews}`;
    return { ...base, state: 'active', label: 'Active', tone: 'success', message };
}

/** "100% off" or "PKR 100 off" from a Paddle discount record; null when it is not a customer-facing discount. */
export function describeDiscount(discount: { type?: string; amount?: string; currency_code?: string } | null, formatMinor: (amount: string, currency: string) => string) {
    if (!discount?.amount) return null;
    if (discount.type === 'percentage') return `${Number(discount.amount)}% off`;
    if (discount.type === 'flat' || discount.type === 'flat_per_seat') return discount.currency_code ? `${formatMinor(discount.amount, discount.currency_code)} off` : null;
    return null;
}
