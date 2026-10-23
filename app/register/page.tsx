import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-session';
import { PlanIntent } from '@/components/customer/plan-intent';
import { EmailStep, OtpStep, CustomerInfoStep } from '@/components/customer/register-flow';
import { verifyRegPendingToken, verifyRegVerifiedToken, REG_PENDING_COOKIE, REG_VERIFIED_COOKIE } from '@/lib/customer-auth';

export default async function CustomerRegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
    const { plan } = await searchParams;
    // Already signed in: a pricing button goes straight to site creation with that plan.
    if (plan && /^[A-Za-z0-9_-]{1,64}$/.test(plan) && (await getCustomerSession())) redirect(`/dashboard/sites/new?plan=${encodeURIComponent(plan)}`);
    const cookieStore = await cookies();

    const verifiedToken = cookieStore.get(REG_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyRegVerifiedToken(verifiedToken) : null;
    if (verified) {
        return <><PlanIntent /><CustomerInfoStep email={verified.email} /></>;
    }

    const pendingToken = cookieStore.get(REG_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyRegPendingToken(pendingToken) : null;
    if (pending) {
        return <><PlanIntent /><OtpStep email={pending.email} /></>;
    }

    return <><PlanIntent /><EmailStep /></>;
}
