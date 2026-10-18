import 'server-only';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull, lt, ne, sql } from 'drizzle-orm';
import type { VerificationPurpose } from '@/db/types';
import { db, schema } from '@/lib/db';
import { clear, clientIp, consume } from '@/lib/rate-limit';

const MAX_OTP_ATTEMPTS = 5;
const OTP_REJECTED = 'That code is incorrect or has expired. Request a new one if needed.';

export function generateOtp() {
    return String(randomInt(100000, 1000000));
}

function sameCode(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}

// The same answer for a wrong, expired or unknown code, so it cannot reveal which addresses have accounts.
export async function checkOtp(email: string, purpose: VerificationPurpose, code: string, ip?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const caller = ip ?? (await clientIp());
    for (const [key, limit] of [[`otp-verify:${purpose}:${email}`, MAX_OTP_ATTEMPTS], [`otp-verify-ip:${caller}`, 30]] as const) {
        const state = await consume(key, limit, 15 * 60);
        if (!state.allowed) return { ok: false, error: state.message };
    }

    const record = await db.query.emailVerification.findFirst({
        where: and(
            eq(schema.emailVerification.email, email),
            eq(schema.emailVerification.purpose, purpose),
            isNull(schema.emailVerification.verifiedAt),
        ),
        orderBy: desc(schema.emailVerification.createdAt),
    });
    if (!record || record.expiresAt < new Date()) return { ok: false, error: OTP_REJECTED };

    const [counted] = await db
        .update(schema.emailVerification)
        .set({ attempts: sql`${schema.emailVerification.attempts} + 1` })
        .where(and(
            eq(schema.emailVerification.id, record.id),
            lt(schema.emailVerification.attempts, MAX_OTP_ATTEMPTS),
            isNull(schema.emailVerification.verifiedAt),
        ))
        .returning({ id: schema.emailVerification.id });
    if (!counted || !sameCode(record.otp, code)) return { ok: false, error: OTP_REJECTED };

    const [spent] = await db
        .update(schema.emailVerification)
        .set({ verifiedAt: new Date() })
        .where(and(eq(schema.emailVerification.id, record.id), isNull(schema.emailVerification.verifiedAt)))
        .returning({ id: schema.emailVerification.id });
    if (!spent) return { ok: false, error: OTP_REJECTED };

    await db.delete(schema.emailVerification).where(and(
        eq(schema.emailVerification.email, email),
        eq(schema.emailVerification.purpose, purpose),
        ne(schema.emailVerification.id, record.id),
    ));
    await clear(`otp-verify:${purpose}:${email}`);
    return { ok: true };
}

export async function allowCodeRequest(email: string, purpose: VerificationPurpose, ip?: string) {
    const caller = ip ?? (await clientIp());
    const byEmail = await consume(`otp-send:${purpose}:${email}`, 5, 3600);
    if (!byEmail.allowed) return byEmail;
    return consume(`otp-send-ip:${purpose}:${caller}`, 20, 3600);
}
