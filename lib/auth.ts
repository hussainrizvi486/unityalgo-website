import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'unityalgo_admin_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const ADMIN_AUDIENCE = 'admin';

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { audience: ADMIN_AUDIENCE });
    return typeof payload.email === 'string' ? (payload as { email: string }) : null;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_DURATION_SECONDS };
