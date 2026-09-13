import { cookies } from 'next/headers';
import { ForgotPasswordEmailStep, ForgotPasswordOtpStep, ResetPasswordStep } from '@/components/customer/forgot-password-flow';
import { verifyResetToken, RESET_PENDING_COOKIE, RESET_VERIFIED_COOKIE } from '@/lib/customer-auth';

export default async function ForgotPasswordPage() {
    const cookieStore = await cookies();

    const verifiedToken = cookieStore.get(RESET_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyResetToken(verifiedToken) : null;
    if (verified) {
        return <ResetPasswordStep email={verified.email} />;
    }

    const pendingToken = cookieStore.get(RESET_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyResetToken(pendingToken) : null;
    if (pending) {
        return <ForgotPasswordOtpStep email={pending.email} />;
    }

    return <ForgotPasswordEmailStep />;
}
