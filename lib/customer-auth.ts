import { SignJWT, jwtVerify } from 'jose';

const CUSTOMER_SESSION_COOKIE = 'unityalgo_customer_session';
const CUSTOMER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

const REG_PENDING_COOKIE = 'unityalgo_reg_pending';
const REG_VERIFIED_COOKIE = 'unityalgo_reg_verified';
const REG_PENDING_DURATION_SECONDS = 60 * 15; // 15 minutes to enter the OTP
const REG_VERIFIED_DURATION_SECONDS = 60 * 30; // 30 minutes to finish the form

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
    sessionId?: string;
}

export async function createCustomerSessionToken(
    payload: CustomerSessionPayload,
) {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${CUSTOMER_SESSION_DURATION_SECONDS}s`)
        .sign(getSecretKey());
}

export async function verifyCustomerSessionToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        if (typeof payload.userId !== 'string' || typeof payload.sessionId !== 'string' || payload.purpose !== undefined) return null;
        return payload as unknown as CustomerSessionPayload;
    } catch {
        return null;
    }
}

type EmailTokenPurpose = 'reg_pending' | 'reg_verified' | 'reset_pending' | 'reset_verified';

async function signEmailToken(email: string, purpose: EmailTokenPurpose, durationSeconds: number) {
    return new SignJWT({ email, purpose })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${durationSeconds}s`)
        .sign(getSecretKey());
}

async function verifyEmailToken(token: string, purpose: EmailTokenPurpose) {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        if (payload.purpose !== purpose || typeof payload.email !== 'string') return null;
        return payload as unknown as { email: string };
    } catch {
        return null;
    }
}

export const signPendingEmailToken = (email: string) => signEmailToken(email, 'reg_pending', REG_PENDING_DURATION_SECONDS);
export const signVerifiedEmailToken = (email: string) => signEmailToken(email, 'reg_verified', REG_VERIFIED_DURATION_SECONDS);
export const signResetPendingToken = (email: string) => signEmailToken(email, 'reset_pending', RESET_PENDING_DURATION_SECONDS);
export const signResetVerifiedToken = (email: string) => signEmailToken(email, 'reset_verified', RESET_VERIFIED_DURATION_SECONDS);

export const verifyRegPendingToken = (token: string) => verifyEmailToken(token, 'reg_pending');
export const verifyRegVerifiedToken = (token: string) => verifyEmailToken(token, 'reg_verified');
export const verifyResetPendingToken = (token: string) => verifyEmailToken(token, 'reset_pending');
export const verifyResetVerifiedToken = (token: string) => verifyEmailToken(token, 'reset_verified');

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
