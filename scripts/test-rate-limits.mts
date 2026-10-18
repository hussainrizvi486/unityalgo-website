import 'dotenv/config';
import { like, eq } from 'drizzle-orm';
import { db, schema, closeDb } from '../lib/db';
import { clear, consume, hit, peek } from '../lib/rate-limit';
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from '../lib/login-limits';
import { checkOtp, generateOtp } from '../lib/otp';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
    if (!ok) failed++;
}

const run = `zz-${Date.now()}`;
const email = `${run}@example.test`;

try {
    // counters
    const key = `test:${run}:count`;
    await Promise.all(Array.from({ length: 20 }, () => hit(key, 60)));
    check('parallel hits are all counted', (await peek(key)).count === 20, String((await peek(key)).count));
    await db.update(schema.rateLimit).set({ resetAt: new Date(Date.now() - 1000) }).where(eq(schema.rateLimit.key, key));
    check('an ended window counts as empty', (await peek(key)).count === 0);
    check('and starts again from one', (await hit(key, 60)).count === 1);
    const first = await consume(`test:${run}:consume`, 2, 60);
    await consume(`test:${run}:consume`, 2, 60);
    const third = await consume(`test:${run}:consume`, 2, 60);
    check('consume allows up to the limit and then refuses', first.allowed && !third.allowed && /Try again in/.test(third.message));

    // login
    const ip = '203.0.113.7';
    check('a fresh account can sign in', (await checkLoginAllowed(email, ip)).allowed);
    for (let i = 0; i < 5; i++) await recordLoginFailure(email, ip);
    const locked = await checkLoginAllowed(email, ip);
    check('five failures lock that account from that address', !locked.allowed && /Try again in/.test((locked as { message: string }).message));
    check('the same account from another address is still allowed', (await checkLoginAllowed(email, '203.0.113.8')).allowed);
    for (let i = 0; i < 15; i++) await recordLoginFailure(email, `198.51.100.${i}`);
    check('twenty failures from anywhere lock the account everywhere', !(await checkLoginAllowed(email, '192.0.2.1')).allowed);
    const other = `${run}-b@example.test`;
    for (let i = 0; i < 3; i++) await recordLoginFailure(other, ip);
    await recordLoginSuccess(other, ip);
    for (let i = 0; i < 4; i++) await recordLoginFailure(other, ip);
    check('a correct password clears the count for that address', (await checkLoginAllowed(other, ip)).allowed);
    let blockedByAddress = false;
    for (let i = 0; i < 35; i++) {
        const gate = await checkLoginAllowed(`${run}-${i}@example.test`, '203.0.113.99');
        if (!gate.allowed) { blockedByAddress = true; break; }
    }
    check('one address trying many accounts is stopped', blockedByAddress);

    // one-time codes
    check('codes are six digits', Array.from({ length: 200 }, generateOtp).every((code) => /^\d{6}$/.test(code)));
    const insert = async (code: string, purpose: 'REGISTRATION' | 'PASSWORD_RESET' = 'PASSWORD_RESET', minutes = 10) => {
        const [row] = await db.insert(schema.emailVerification).values({ email: `${run}-otp@example.test`, otp: code, purpose, expiresAt: new Date(Date.now() + minutes * 60_000) }).returning();
        return row;
    };
    const otpEmail = `${run}-otp@example.test`;
    const cleanOtp = async () => { await db.delete(schema.emailVerification).where(like(schema.emailVerification.email, `${run}%`)); await clear(`otp-verify:PASSWORD_RESET:${otpEmail}`); await clear(`otp-verify:REGISTRATION:${otpEmail}`); };

    await insert('123456');
    const wrong = await checkOtp(otpEmail, 'PASSWORD_RESET', '000000', '203.0.113.50');
    check('a wrong code is refused', !wrong.ok);
    const right = await checkOtp(otpEmail, 'PASSWORD_RESET', '123456', '203.0.113.50');
    check('the right code still works after one miss', right.ok);
    check('and cannot be used twice', !(await checkOtp(otpEmail, 'PASSWORD_RESET', '123456', '203.0.113.50')).ok);
    await cleanOtp();

    await insert('654321');
    const messages = new Set<string>();
    for (let i = 0; i < 5; i++) {
        const result = await checkOtp(otpEmail, 'PASSWORD_RESET', String(100000 + i), '203.0.113.51');
        if (!result.ok) messages.add(result.error);
    }
    const afterGuesses = await checkOtp(otpEmail, 'PASSWORD_RESET', '654321', '203.0.113.51');
    check('after five wrong guesses even the right code is refused', !afterGuesses.ok);
    const stored = await db.query.emailVerification.findFirst({ where: eq(schema.emailVerification.email, otpEmail) });
    check('the guesses are counted on the code', (stored?.attempts ?? 0) >= 5, String(stored?.attempts));
    await cleanOtp();

    await insert('111111', 'PASSWORD_RESET', -1);
    const expired = await checkOtp(otpEmail, 'PASSWORD_RESET', '111111', '203.0.113.52');
    await cleanOtp();
    const none = await checkOtp(`${run}-nobody@example.test`, 'PASSWORD_RESET', '111111', '203.0.113.53');
    check('an expired code and an unknown address get the same answer', !expired.ok && !none.ok && expired.error === none.error, `${!expired.ok && expired.error} | ${!none.ok && none.error}`);
    await clear(`otp-verify:PASSWORD_RESET:${run}-nobody@example.test`);

    await insert('222222');
    await insert('333333');
    await db.update(schema.emailVerification).set({ createdAt: new Date(Date.now() + 1000) }).where(eq(schema.emailVerification.otp, '333333'));
    await checkOtp(otpEmail, 'PASSWORD_RESET', '333333', '203.0.113.54');
    const left = await db.query.emailVerification.findMany({ where: eq(schema.emailVerification.email, otpEmail) });
    check('a code that works also cancels the other codes for that address', left.length === 1 && left[0].otp === '333333');
    await cleanOtp();
} finally {
    await db.delete(schema.rateLimit).where(like(schema.rateLimit.key, `%${run}%`));
    await db.delete(schema.rateLimit).where(like(schema.rateLimit.key, 'login:ip:203.0.113.%'));
    await db.delete(schema.rateLimit).where(like(schema.rateLimit.key, 'login:acct-ip:%@example.test:%'));
    await db.delete(schema.rateLimit).where(like(schema.rateLimit.key, 'otp-verify-ip:203.0.113.%'));
    await db.delete(schema.rateLimit).where(like(schema.rateLimit.key, 'login:acct:zz-%'));
    await db.delete(schema.emailVerification).where(like(schema.emailVerification.email, 'zz-%'));
    await closeDb();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
