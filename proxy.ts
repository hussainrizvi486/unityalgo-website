import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_SESSION_COOKIE = 'unityalgo_admin_session';
const CUSTOMER_SESSION_COOKIE = 'unityalgo_customer_session';

const PUBLIC_CUSTOMER_PATHS = new Set(['/register', '/customer/forgot-password']);

function toLogin(pathname: string, request: NextRequest) {
    return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url),
    );
}

async function isSessionValid(token: string | undefined, kind: 'admin' | 'customer') {
    if (!token) return false;
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;

    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), kind === 'admin' ? { audience: 'admin' } : undefined);
        return kind === 'admin' || (typeof payload.sessionId === 'string' && payload.purpose === undefined);
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
        const valid = await isSessionValid(token, 'customer');

        if (!valid) return toLogin(pathname, request);

        return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await isSessionValid(token, 'admin');

    if (!valid) {
        // An API client wants a status code, not a redirect to a page it cannot use.
        if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return toLogin(pathname, request);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*', '/customer/:path*', '/dashboard/:path*'],
};
