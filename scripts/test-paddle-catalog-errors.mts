import assert from 'node:assert/strict';
import { paddleRequest, PaddleApiError } from '../lib/paddle-catalog';
const originalFetch = globalThis.fetch;
const originalKey = process.env.PADDLE_API_KEY;
process.env.PADDLE_API_KEY = 'test_key';
try {
    globalThis.fetch = async () => Response.json({ error: { detail: 'Invalid request.', code: 'invalid_field', errors: [{ field: 'unit_price.currency_code', message: 'Currency is not supported.' }] }, meta: { request_id: 'request-test' } }, { status: 400 });
    await assert.rejects(paddleRequest('/prices'), (error: unknown) => {
        assert.ok(error instanceof PaddleApiError);
        assert.equal(error.status, 400);
        assert.equal(error.code, 'invalid_field');
        assert.equal(error.requestId, 'request-test');
        assert.match(error.message, /unit_price.currency_code: Currency is not supported/);
        return true;
    });
    globalThis.fetch = async () => Response.json({ error: { detail: 'Authentication failed.' } }, { status: 401 });
    await assert.rejects(paddleRequest('/prices'), (error: unknown) => error instanceof PaddleApiError && error.status === 401 && error.message === 'Authentication failed.');
    console.log('ok Paddle validation details and plain error responses');
} finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = originalKey;
}
