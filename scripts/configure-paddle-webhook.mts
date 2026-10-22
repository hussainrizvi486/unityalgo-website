/** Configure an explicitly supplied HTTPS destination without printing its signing secret. */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { paddleRequest } from '../lib/paddle-catalog';
import { PADDLE_EVENTS } from '../lib/paddle';
import { asRecord, asString } from '../lib/paddle-data';
const input = process.argv[2] ?? process.env.PUBLIC_APP_URL;
if (!input) throw new Error('Provide the public HTTPS app URL. Localhost requires an HTTPS tunnel.');
const url = new URL(input);
if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password) throw new Error('An externally reachable HTTPS URL is required.');
url.pathname = '/api/paddle/webhook'; url.search = ''; url.hash = '';
const id = process.env.PADDLE_NOTIFICATION_SETTING_ID;
const result = asRecord(await paddleRequest(id ? `/notification-settings/${id}` : '/notification-settings', {
    method: id ? 'PATCH' : 'POST', body: JSON.stringify({ description: 'UnityAlgo billing synchronization', type: 'url', destination: url.toString(), subscribed_events: Object.values(PADDLE_EVENTS), api_version: 1, include_sensitive_fields: false, traffic_source: 'platform', active: true }),
}));
const secret = asString(result.endpoint_secret_key);
const destinationId = asString(result.id);
if (!secret || !destinationId) throw new Error('Paddle did not return the destination signing secret.');
let env = await readFile('.env', 'utf8');
for (const [name, value] of Object.entries({ PADDLE_WEBHOOK_SECRET: secret, PADDLE_NOTIFICATION_SETTING_ID: destinationId, PUBLIC_APP_URL: url.origin })) {
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env}\n${name}=${value}\n`;
}
await writeFile('.env', env);
console.log(`Configured ${url.toString()}. Restart the app to load its signing secret.`);
