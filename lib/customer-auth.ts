import { SignJWT, jwtVerify } from 'jose';

// Deliberately separate from lib/auth.ts's admin session — different cookie
// name, different payload shape, and proxy.ts guards each independently, so
// an admin session can never be mistaken for a customer session or vice versa.
const CUSTOMER_SESSION_COOKIE = 'unityalgo_customer_session';
const CUSTOMER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Short-lived cookies that carry state through the registration wizard, so a
// page refresh on step 2/3 doesn't lose progress — each is a signed token,
// not a plain cookie, so the email inside can't be tampered with client-side.
const REG_PENDING_COOKIE = 'unityalgo_reg_pending';
const REG_VERIFIED_COOKIE = 'unityalgo_reg_verified';
const REG_PENDING_DURATION_SECONDS = 60 * 15; // 15 minutes to enter the OTP
const REG_VERIFIED_DURATION_SECONDS = 60 * 30; // 30 minutes to finish the form

// Same pattern as the registration cookies above, for the "forgot password"
// wizard — kept as separate cookies/tokens so a reset in progress can never
// be confused with a registration in progress for the same email.
const RESET_PENDING_COOKIE = 'unityalgo_reset_pending';
const RESET_VERIFIED_COOKIE = 'unityalgo_reset_verified';
const RESET_PENDING_DURATION_SECONDS = 60 * 15; // 15 minutes to enter the OTP
const RESET_VERIFIED_DURATION_SECONDS = 60 * 15; // 15 minutes to set a new password

function getSecretKey() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET environment variable is not set');
    }
    return new TextEncoder().encode(secret);
}

interface CustomerSessionPayload {
    userId: string;
    email: string;
}

export async function createCustomerSessionToken(payload: CustomerSessionPayload) {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${CUSTOMER_SESSION_DURATION_SECONDS}s`)
        .sign(getSecretKey());
}

export async function verifyCustomerSessionToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        return payload as unknown as CustomerSessionPayload;
    } catch {
        return null;
    }
}

async function signEmailToken(email: string, durationSeconds: number) {
    return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${durationSeconds}s`)
        .sign(getSecretKey());
}

async function verifyEmailToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        return payload as unknown as { email: string };
    } catch {
        return null;
    }
}

export function signPendingEmailToken(email: string) {
    return signEmailToken(email, REG_PENDING_DURATION_SECONDS);
}

export function signVerifiedEmailToken(email: string) {
    return signEmailToken(email, REG_VERIFIED_DURATION_SECONDS);
}

export function signResetPendingToken(email: string) {
    return signEmailToken(email, RESET_PENDING_DURATION_SECONDS);
}

export function signResetVerifiedToken(email: string) {
    return signEmailToken(email, RESET_VERIFIED_DURATION_SECONDS);
}

export const verifyRegToken = verifyEmailToken;
export const verifyResetToken = verifyEmailToken;

export {
    CUSTOMER_SESSION_COOKIE,
    CUSTOMER_SESSION_DURATION_SECONDS,
    REG_PENDING_COOKIE,
    REG_VERIFIED_COOKIE,
    REG_PENDING_DURATION_SECONDS,
    REG_VERIFIED_DURATION_SECONDS,
    RESET_PENDING_COOKIE,
    RESET_VERIFIED_COOKIE,
    RESET_PENDING_DURATION_SECONDS,
    RESET_VERIFIED_DURATION_SECONDS,
};
