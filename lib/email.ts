import 'server-only';
import { sendEventEmail } from '@/lib/email-templates';

export async function sendVerificationEmail(to: string, otp: string) {
    await sendEventEmail('verification_code', to, { otp, expires_minutes: '10', 'user.email': to, 'user.name': '' });
}
