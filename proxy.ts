import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_SESSION_COOKIE = 'unityalgo_admin_session';
const CUSTOMER_SESSION_COOKIE = 'unityalgo_customer_session';

// Sign-in moved to /login, which is outside this middleware's matcher and so
// needs no exemption. These are the customer-area pages that stay public.
const PUBLIC_CUSTOMER_PATHS = new Set(['/register', '/customer/forgot-password']);

/** Sends an unauthenticated visitor to the shared sign-in, keeping their
 *  destination so they land where they were headed. */
function toLogin(pathname: string, request: NextRequest) {
    return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url),
    );
}

async function isSessionValid(token: string | undefined) {
    if (!token) return false;
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;

    try {
        await jwtVerify(token, new TextEncoder().encode(secret));
        return true;
    } catch {
        return false;
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith('/dashboard') || pathname.startsWith('/customer')) {
        if (PUBLIC_CUSTOMER_PATHS.has(pathname)) {
            return NextResponse.next();
        }

        const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
        const valid = await isSessionValid(token);

        if (!valid) return toLogin(pathname, request);

        return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await isSessionValid(token);

    if (!valid) return toLogin(pathname, request);

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*', '/customer/:path*', '/dashboard/:path*'],
};
