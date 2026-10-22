import assert from 'node:assert/strict';
import { reportBillingFailure } from '../lib/billing-errors';
import { PaddleApiError } from '../lib/paddle-catalog';
const original = console.error;
const logs: unknown[][] = [];
console.error = (...args: unknown[]) => { logs.push(args); };
try {
    const result = reportBillingFailure({ message: 'private SQL', query: 'private SQL', params: ['SECRET-TEST-VALUE'], cause: { code: '42703', column: 'siteOrderId' } }, { action: 'start_site_payment', orderId: 'test-order' });
    assert.match(result.message, /Billing database setup is incomplete/);
    assert.ok(result.reference);
    assert.ok(!JSON.stringify(logs).includes('SECRET-TEST-VALUE'));
    assert.ok(!JSON.stringify(logs).includes('private SQL'));
    const provider = reportBillingFailure(new PaddleApiError('Sensitive provider detail', 403, 'forbidden', 'request-test', ['items']), { action: 'create_checkout' });
    assert.match(provider.message, /configuration needs attention/);
    assert.ok(!JSON.stringify(logs).includes('Sensitive provider detail'));
    assert.ok(JSON.stringify(logs).includes('request-test'));
} finally { console.error = original; }
console.log('ok billing failure references, migration diagnostics and redacted logging');
