import assert from 'node:assert/strict';
import { describeSubscription, describeDiscount, type SubscriptionInput } from '../lib/subscription-view';

const base: SubscriptionInput = { status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: new Date('2026-11-10T00:00:00Z'), graceEndsAt: null, canceledAt: null, billedOnline: true, planName: 'Plus', price: 'PKR 5,700/month', discount: null, idle: false, now: new Date('2026-10-23T00:00:00Z') };
const view = (over: Partial<SubscriptionInput>) => describeSubscription({ ...base, ...over });
let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${name}`); };

ok('active with a discount reads like the product brief', () => {
    const v = view({ discount: '100% off' });
    assert.equal(v.message, "You've got 100% off Plus. Your plan renews at PKR 5,700/month on November 10, 2026.");
    assert.equal(v.state, 'active'); assert.ok(v.canUpgrade && v.canCancel && !v.canResume);
});
ok('active without a discount', () => assert.equal(view({}).message, 'Your Plus plan is active. Your plan renews at PKR 5,700/month on November 10, 2026.'));
ok('a scheduled cancellation keeps access, blocks upgrade and offers resume', () => {
    const v = view({ cancelAtPeriodEnd: true });
    assert.equal(v.state, 'cancelling'); assert.match(v.message, /keep using it until November 10, 2026/); assert.ok(v.canResume && !v.canCancel && !v.canUpgrade && !v.canCreateSite);
});
ok('past due asks for a payment method and cannot upgrade', () => {
    const v = view({ status: 'PAST_DUE', graceEndsAt: new Date('2026-10-26T00:00:00Z') });
    assert.equal(v.state, 'past_due'); assert.match(v.message, /by October 26, 2026/); assert.ok(v.canUpdatePayment && v.canCancel && !v.canUpgrade);
});
ok('canceled is final: no actions', () => {
    const v = view({ status: 'CANCELED', canceledAt: new Date('2026-10-01T00:00:00Z') });
    assert.equal(v.state, 'canceled'); assert.ok(!v.canUpgrade && !v.canCancel && !v.canResume && !v.canCreateSite && v.canUpdatePayment === false);
});
ok('an overdue period shows a confirming state, not a wrong renewal date', () => {
    const v = view({ currentPeriodEnd: new Date('2026-10-01T00:00:00Z') });
    assert.equal(v.state, 'renewing'); assert.ok(!v.canUpgrade);
});
ok('a paid subscription without a site offers to create one', () => assert.ok(view({ idle: true }).canCreateSite));
ok('a subscription not billed online cannot be changed here', () => { const v = view({ billedOnline: false }); assert.ok(!v.canCancel && !v.canUpgrade && !v.canUpdatePayment); });
ok('discount text', () => {
    const money = (amount: string, currency: string) => `${currency} ${Number(amount) / 100}`;
    assert.equal(describeDiscount({ type: 'percentage', amount: '100' }, money), '100% off');
    assert.equal(describeDiscount({ type: 'flat', amount: '10000', currency_code: 'PKR' }, money), 'PKR 100 off');
    assert.equal(describeDiscount(null, money), null);
});
console.log(`${n} subscription view checks passed`);
