import 'server-only';
import { sendMail } from '@/lib/mail-accounts';

/**
 * The messages the platform sends.
 *
 * Transport selection lives in lib/mail-accounts.ts: each message declares what
 * kind of mail it is and the account configured for that purpose is used, with
 * the SMTP_* environment variables as the fallback. This file is only concerned
 * with content.
 */

export async function sendVerificationEmail(to: string, otp: string) {
    await sendMail('TRANSACTIONAL', {
        to,
        subject: 'Verify your UnityAlgo account',
        text: `Your verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <p>Your UnityAlgo verification code is:</p>
                <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em; margin: 16px 0;">${otp}</p>
                <p style="color: #707070; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        `,
    });
}
