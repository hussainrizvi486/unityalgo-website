import 'server-only';
import { clear, clientIp, hit, peek, retryMessage } from '@/lib/rate-limit';

const MINUTE = 60;

const LIMITS = {
    ip: { limit: 30, window: 10 * MINUTE },
    /** Failures for one account from one address: stops guessing a password. */
    accountFromIp: { limit: 5, window: 15 * MINUTE },
    account: { limit: 20, window: 15 * MINUTE },
};

const keys = (email: string, ip: string) => ({
    ip: `login:ip:${ip}`,
    accountFromIp: `login:acct-ip:${email}:${ip}`,
    account: `login:acct:${email}`,
});

export type LoginGate = { allowed: true; ip: string } | { allowed: false; message: string; ip: string };

export async function checkLoginAllowed(email: string, caller?: string): Promise<LoginGate> {
    const ip = caller ?? (await clientIp());
    const k = keys(email, ip);
    const attempt = await hit(k.ip, LIMITS.ip.window);
    if (attempt.count > LIMITS.ip.limit) return { allowed: false, message: retryMessage(attempt.resetAt), ip };
    for (const [name, key] of [['accountFromIp', k.accountFromIp], ['account', k.account]] as const) {
        const state = await peek(key);
        if (state.count >= LIMITS[name].limit) return { allowed: false, message: retryMessage(state.resetAt), ip };
    }
    return { allowed: true, ip };
}

export async function recordLoginFailure(email: string, ip: string) {
    const k = keys(email, ip);
    await Promise.all([hit(k.accountFromIp, LIMITS.accountFromIp.window), hit(k.account, LIMITS.account.window)]);
}

/** A correct password clears the owner's own counters. */
export async function recordLoginSuccess(email: string, ip: string) {
    await clear(keys(email, ip).accountFromIp);
}
