import 'server-only';
import { cookies } from 'next/headers';

/** The plan a visitor picked on the pricing page, kept in a short cookie while they sign in or register. */
export const PLAN_INTENT_COOKIE = 'ua_plan';

/** Where to send a customer who came from a pricing button, once. Null when they did not pick a plan. */
export async function takePlanIntent() {
    const store = await cookies();
    const value = store.get(PLAN_INTENT_COOKIE)?.value ?? '';
    if (!value) return null;
    store.delete(PLAN_INTENT_COOKIE);
    return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? `/dashboard/sites/new?plan=${encodeURIComponent(value)}` : null;
}
