import 'dotenv/config';
import { SignJWT } from 'jose';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

const targets = process.argv.slice(2);
if (targets.length === 0) {
    console.error('usage: tsx scripts/check-pages.ts <path>[::expected text] ...');
    process.exit(2);
}

async function main() {
    const token = await new SignJWT({ email: process.env.ADMIN_EMAIL ?? 'admin@unityalgo.com', role: 'ADMIN' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(SECRET);

    let failed = 0;
    for (const target of targets) {
        const [path, expected] = target.split('::');
        const res = await fetch(`${BASE}${path}`, {
            headers: { cookie: `unityalgo_admin_session=${token}` },
            redirect: 'manual',
        });
        const body = res.status === 200 ? await res.text() : '';
        // The digest marker is what a thrown server-component error leaves behind.
        const crashed = /"digest"|Application error|__next_error__/.test(body);
        const missing = expected && !body.includes(expected);
        const ok = res.status === 200 && !crashed && !missing;
        if (!ok) failed += 1;
        console.log(
            `  ${ok ? 'PASS' : 'FAIL'}  ${path}  [${res.status}]` +
            (crashed ? '  render error' : '') +
            (missing ? `  missing “${expected}”` : ''),
        );
    }
    console.log(failed === 0 ? '\nall pages rendered' : `\n${failed} page(s) failed`);
    process.exit(failed === 0 ? 0 : 1);
}

main();
