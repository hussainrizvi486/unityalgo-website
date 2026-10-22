/** Real sandbox validation. Creates isolated test catalog/draft records; never collects a payment. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' || !process.env.PADDLE_API_KEY) throw new Error('Configured sandbox credentials are required.');
const key = process.env.PADDLE_API_KEY;
async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`https://sandbox-api.paddle.com${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Paddle-Version': '1' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${response.status} ${result.error?.code ?? 'provider_error'}`);
    return result.data;
}
const stamp = randomUUID().slice(0, 8);
const cleanup: Array<[string, unknown]> = [];
try {
    const product = await request('/products', 'POST', { name: `Credit validation ${stamp}`, tax_category: 'standard' });
    cleanup.unshift([`/products/${product.id}`, { status: 'archived' }]);
    const price = await request('/prices', 'POST', { product_id: product.id, description: `Credit validation ${stamp}`, unit_price: { amount: '3000', currency_code: 'USD' }, billing_cycle: { interval: 'month', frequency: 1 }, tax_mode: 'external' });
    cleanup.unshift([`/prices/${price.id}`, { status: 'archived' }]);
    const customer = await request('/customers', 'POST', { email: `credit-validation-${stamp}@example.com`, name: 'Sandbox Credit Validation' });
    cleanup.unshift([`/customers/${customer.id}`, { status: 'archived' }]);
    const address = await request(`/customers/${customer.id}/addresses`, 'POST', { country_code: 'GB', postal_code: 'SW1A 1AA' });
    for (const amount of ['1000', '3000']) {
        const discount = await request('/discounts', 'POST', { description: `Account credits validation ${stamp}`, type: 'flat', amount, currency_code: 'USD', enabled_for_checkout: false, recur: false, usage_limit: 1, restrict_to: [price.id] });
        cleanup.unshift([`/discounts/${discount.id}`, { status: 'archived' }]);
        const preview = await request('/transactions/preview', 'POST', { items: [{ price_id: price.id, quantity: 1 }], customer_id: customer.id, address_id: address.id, currency_code: 'USD', discount_id: discount.id });
        assert.equal(preview.details.totals.discount, amount);
        if (amount === '3000') assert.equal(preview.details.totals.grand_total, '0');
        const draft = await request('/transactions', 'POST', { items: [{ price_id: price.id, quantity: 1 }], customer_id: customer.id, currency_code: 'USD', discount_id: discount.id, collection_mode: 'automatic' });
        cleanup.unshift([`/transactions/${draft.id}`, { status: 'canceled' }]);
        assert.equal(draft.discount_id, discount.id);
        assert.equal(draft.status, 'draft');
        console.log(`ok sandbox ${amount === '3000' ? 'full' : 'partial'} plan credit: preview and server-created draft`);
    }
    const subscriptions = await request('/subscriptions?status=active&per_page=10');
    const active = subscriptions.find((s: { currency_code: string; items: unknown[] }) => s.currency_code === 'USD' && s.items.length > 0);
    if (active) {
        const items = active.items.map((item: { price: { id: string }; quantity: number }, index: number) => ({ price_id: index === 0 ? price.id : item.price.id, quantity: item.quantity }));
        const discount = await request('/discounts', 'POST', { description: `Prorated credits validation ${stamp}`, type: 'flat', amount: '1000', currency_code: 'USD', enabled_for_checkout: false, recur: true, maximum_recurring_intervals: 1, usage_limit: 1, restrict_to: [price.id] });
        cleanup.unshift([`/discounts/${discount.id}`, { status: 'archived' }]);
        const preview = await request(`/subscriptions/${active.id}/preview`, 'PATCH', { items, proration_billing_mode: 'prorated_immediately', on_payment_failure: 'prevent_change', discount: { id: discount.id, effective_from: 'immediately' } });
        assert.ok(preview.immediate_transaction);
        const applied = Number(preview.immediate_transaction.details.totals.discount);
        assert.ok(Number.isSafeInteger(applied) && applied >= 0 && applied <= 1000);
        console.log('ok sandbox prorated change accepts bounded one-period credit discount');
        const renewalDiscount = await request('/discounts', 'POST', { description: `Next invoice credit validation ${stamp}`, type: 'flat', amount: '1000', currency_code: 'USD', enabled_for_checkout: false, recur: true, maximum_recurring_intervals: 1, usage_limit: 1, restrict_to: [active.items[0].price.id] });
        cleanup.unshift([`/discounts/${renewalDiscount.id}`, { status: 'archived' }]);
        const renewal = await request(`/subscriptions/${active.id}/preview`, 'PATCH', { proration_billing_mode: 'do_not_bill', discount: { id: renewalDiscount.id, effective_from: 'next_billing_period' } });
        const renewalAmount = Number(renewal.next_transaction.details.totals.discount);
        assert.ok(Number.isSafeInteger(renewalAmount) && renewalAmount > 0 && renewalAmount <= 1000);
        console.log('ok sandbox next-renewal preview accepts a single-period credit discount');
    } else console.log('SKIP real upgrade preview: no active USD sandbox subscription.');
} finally {
    let failures = 0;
    for (const [path, body] of cleanup) {
        try { await request(path, 'PATCH', body); }
        catch (error) { failures++; console.error('Sandbox cleanup needs review:', path.split('/')[1], error instanceof Error ? error.message : 'error'); }
    }
    if (failures) process.exitCode = 1;
}
