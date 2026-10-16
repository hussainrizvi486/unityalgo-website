import 'server-only';
import { sendMail } from '@/lib/mail-accounts';
import { emailStyle } from '@/lib/email-theme';

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
            <div style="${emailStyle.page}">
                <p>Your UnityAlgo verification code is:</p>
                <p style="${emailStyle.code}">${otp}</p>
                <p style="${emailStyle.muted}">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        `,
    });
}
