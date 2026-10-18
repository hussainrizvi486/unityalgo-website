import 'dotenv/config';
import { SignJWT } from 'jose';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET;

const ADMIN_COOKIE = 'unityalgo_admin_session';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string) {
    passed += 1;
    console.log(`  PASS  ${name}`);
}

function bad(name: string, detail: string) {
    failed += 1;
    failures.push(`${name} — ${detail}`);
    console.log(`  FAIL  ${name}\n        ${detail}`);
}

/** Mint a validly-signed session token with an arbitrary payload, like login does. */
async function mintToken(payload: Record<string, unknown>) {
    if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not set — point it at the running server.');
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(new TextEncoder().encode(SESSION_SECRET));
}

function multipart(filename: string, type: string, bytes: Buffer) {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(bytes)], { type }), filename);
    return form;
}

// 1x1 transparent PNG.
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64',
);
const XSS_SVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"><script>alert(1)</script></svg>',
    'utf8',
);

async function testUploadRequiresAdminRole() {
    const name = 'upload rejects a non-admin session token';
    const token = await mintToken({ email: `nobody-${Date.now()}@example.com` });
    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
        method: 'POST',
        headers: { cookie: `${ADMIN_COOKIE}=${token}` },
        body: multipart('x.png', 'image/png', TINY_PNG),
    });
    if (res.status === 401 || res.status === 403) {
        ok(name);
    } else {
        const body = await res.text();
        bad(name, `expected 401/403, got ${res.status}. A non-admin token was accepted. Body: ${body.slice(0, 200)}`);
    }
}

async function testSvgUploadRejected() {
    const name = 'upload rejects an SVG payload';
    const token = await mintToken({ email: `admin-probe-${Date.now()}@example.com` });
    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
        method: 'POST',
        headers: { cookie: `${ADMIN_COOKIE}=${token}` },
        body: multipart('x.svg', 'image/svg+xml', XSS_SVG),
    });
    if (res.status === 400 || res.status === 415) {
        ok(name);
    } else if (res.status === 401 || res.status === 403) {
        console.log(`  SKIP  ${name} (auth rejected the probe token; re-run with a real admin cookie)`);
    } else {
        bad(name, `expected SVG to be rejected, got ${res.status}. SVG upload enables stored XSS.`);
    }
}

async function testImageProxyNotOpen() {
    const name = 'image optimiser refuses an arbitrary external host';
    const target = 'https://example.com/favicon.ico';
    const res = await fetch(`${BASE_URL}/_next/image?url=${encodeURIComponent(target)}&w=64&q=75`, {
        redirect: 'manual',
    });
    if (res.status === 400) {
        ok(name);
    } else {
        bad(name, `expected 400 for an unlisted host, got ${res.status}. remotePatterns '**' is an open image proxy.`);
    }
}

async function testSecurityHeadersPresent() {
    const name = 'home page sets CSP and anti-framing headers';
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    const csp = res.headers.get('content-security-policy');
    const frame = res.headers.get('x-frame-options') || (csp?.includes('frame-ancestors') ? 'via-csp' : null);
    if (csp && frame) {
        ok(name);
    } else {
        bad(name, `missing ${!csp ? 'Content-Security-Policy ' : ''}${!frame ? 'X-Frame-Options/frame-ancestors' : ''}`.trim());
    }
}

async function testCustomerApiNeedsAuth() {
    const name = 'customer site API refuses an anonymous request';
    const res = await fetch(`${BASE_URL}/api/customer/sites/does-not-exist`, { redirect: 'manual' });
    if (res.status === 401) {
        ok(name);
    } else {
        bad(name, `expected 401, got ${res.status}.`);
    }
}

async function main() {
    console.log(`\nSecurity tests against ${BASE_URL}\n`);
    try {
        await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(4000) });
    } catch {
        console.error(`Cannot reach ${BASE_URL}. Start the server first (npm run dev).`);
        process.exit(2);
    }

    await testUploadRequiresAdminRole();
    await testSvgUploadRejected();
    await testImageProxyNotOpen();
    await testSecurityHeadersPresent();
    await testCustomerApiNeedsAuth();

    console.log('\nMANUAL (not auto-asserted here):');
    console.log('  - Password-reset OTP has no per-record attempt limit: a 6-digit code stays');
    console.log('    guessable for its full 10-minute TTL. Add an attempts counter + lockout.');
    console.log('  - Login has no rate limit/lockout: credential stuffing is unthrottled.');
    console.log('  - Registration and password-reset request reveal whether an email has an');
    console.log('    account (user enumeration). Return the same response either way.');
    console.log('  - proxy.ts is NOT wired as middleware (no middleware.ts); it never runs.');
    console.log('    Every route must self-guard. Rename to middleware.ts or delete it.');

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) {
        console.log('\nFailures:');
        for (const f of failures) console.log(`  - ${f}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
