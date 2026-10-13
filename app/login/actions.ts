'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from '@/lib/auth';
import {
    CUSTOMER_SESSION_COOKIE,
    CUSTOMER_SESSION_DURATION_SECONDS,
} from '@/lib/customer-auth';
import { createTrackedCustomerSession } from '@/lib/login-sessions';

/**
 * One sign-in for both roles.
 *
 * The *page* is shared; the sessions are not. An admin still gets the admin
 * cookie and a customer still gets the customer cookie, because that
 * separation is what stops a customer session opening the admin panel — the
 * property the cross-role isolation tests exist to protect. Merging the two
 * cookies would have quietly removed it.
 */

export interface LoginFormState {
    error?: string;
    /** Echoed back so a failed attempt does not wipe what was typed. */
    email?: string;
}

const HOME_FOR = { ADMIN: '/admin', CUSTOMER: '/dashboard' } as const;

/**
 * Where to send someone after signing in.
 *
 * `next` arrives from the query string, so it is only honoured when it is a
 * path on this site — a bare `/foo`. Anything protocol-relative (`//evil.com`)
 * or absolute would turn the login page into an open redirect. It is also
 * checked against the role: sending a customer to `/admin/users` would just
 * bounce them straight back here.
 */
function safeDestination(next: string | null, role: 'ADMIN' | 'CUSTOMER') {
    const home = HOME_FOR[role];
    if (!next || !next.startsWith('/') || next.startsWith('//')) return home;
    if (next.startsWith('/admin')) return role === 'ADMIN' ? next : home;
    if (next.startsWith('/dashboard')) return role === 'CUSTOMER' ? next : home;
    return next;
}

export async function loginAction(
    _prev: LoginFormState | undefined,
    formData: FormData,
): Promise<LoginFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const next = String(formData.get('next') ?? '') || null;

    const user = await prisma.user.findUnique({ where: { email } });

    // One message for "no such account" and "wrong password" alike: telling
    // them apart lets anyone enumerate which addresses have accounts. bcrypt
    // still runs on a miss so the two paths take comparable time.
    const invalid: LoginFormState = { error: 'Invalid email or password.', email };
    if (!user) {
        await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
        return invalid;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) return invalid;

    const cookieStore = await cookies();
    if (user.role === 'ADMIN') {
        cookieStore.set(SESSION_COOKIE, await createSessionToken(user.email), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_DURATION_SECONDS,
        });
    } else {
        cookieStore.set(
            CUSTOMER_SESSION_COOKIE,
            await createTrackedCustomerSession(user),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: CUSTOMER_SESSION_DURATION_SECONDS,
            },
        );
    }

    redirect(safeDestination(next, user.role));
}
