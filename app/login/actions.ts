'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { takePlanIntent } from '@/lib/plan-intent';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from '@/lib/auth';
import {
    CUSTOMER_SESSION_COOKIE,
    CUSTOMER_SESSION_DURATION_SECONDS,
} from '@/lib/customer-auth';
import { createTrackedCustomerSession } from '@/lib/login-sessions';
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from '@/lib/login-limits';

export interface LoginFormState {
    error?: string;
    /** Echoed back so a failed attempt does not wipe what was typed. */
    email?: string;
}

const HOME_FOR = { ADMIN: '/admin', CUSTOMER: '/dashboard' } as const;

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

    const gate = await checkLoginAllowed(email);
    if (!gate.allowed) return { error: gate.message, email };

    const user = await db.query.user.findFirst({ where: eq(schema.user.email, email) });

    const invalid: LoginFormState = { error: 'Invalid email or password.', email };
    if (!user) {
        await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
        await recordLoginFailure(email, gate.ip);
        return invalid;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
        await recordLoginFailure(email, gate.ip);
        return invalid;
    }
    await recordLoginSuccess(email, gate.ip);

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

    // A customer who came from a pricing button continues to site creation with that plan.
    // The remembered plan is always used up, so it cannot send a later login somewhere unexpected.
    const planDestination = user.role === 'CUSTOMER' ? await takePlanIntent() : null;
    redirect((!next && planDestination) || safeDestination(next, user.role));
}
