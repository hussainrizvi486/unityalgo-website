import 'server-only';
import { Resolver } from 'node:dns/promises';

/** SMTP authentication does not establish that the sender domain trusts it. */
export async function getEmailDeliveryWarning(host: string, address: string): Promise<string | null> {
    if (host.toLowerCase() !== 'smtp.hostinger.com') return null;
    const domain = address.match(/@([a-z0-9.-]+)>?$/i)?.[1];
    if (!domain) return null;

    const resolver = new Resolver({ timeout: 1500, tries: 1 });
    try {
        const records = await resolver.resolveTxt(domain);
        const spf = records.map((parts) => parts.join('')).filter((record) => /^v=spf1(?:\s|$)/i.test(record));
        if (spf.length > 1) {
            return `${domain} has multiple SPF records. Combine the authorised senders into one SPF record; multiple records can prevent verification emails from being authenticated.`;
        }
        if (!spf[0]?.split(/\s+/).some((term) => term.toLowerCase() === 'include:_spf.mail.hostinger.com')) {
            return `${domain} sends through Hostinger, but its SPF record does not include include:_spf.mail.hostinger.com. Review the domain DNS and add Hostinger to the existing SPF record, preserving other senders. Also check Hostinger DKIM records. A successful SMTP connection test confirms login, not inbox delivery.`;
        }
        return null;
    } catch {
        // DNS unavailability must not prevent the admin from editing accounts.
        return `Could not check SPF for ${domain}. Verify SPF and DKIM in your DNS provider; a successful SMTP connection alone does not confirm inbox delivery.`;
    } finally {
        resolver.cancel();
    }
}
