import { cookies } from 'next/headers';
import { EmailStep, OtpStep, CustomerInfoStep } from '@/components/customer/register-flow';
import { verifyRegToken, REG_PENDING_COOKIE, REG_VERIFIED_COOKIE } from '@/lib/customer-auth';

export default async function CustomerRegisterPage() {
    const cookieStore = await cookies();

    const verifiedToken = cookieStore.get(REG_VERIFIED_COOKIE)?.value;
    const verified = verifiedToken ? await verifyRegToken(verifiedToken) : null;
    if (verified) {
        return <CustomerInfoStep email={verified.email} />;
    }

    const pendingToken = cookieStore.get(REG_PENDING_COOKIE)?.value;
    const pending = pendingToken ? await verifyRegToken(pendingToken) : null;
    if (pending) {
        return <OtpStep email={pending.email} />;
    }

    return <EmailStep />;
}
