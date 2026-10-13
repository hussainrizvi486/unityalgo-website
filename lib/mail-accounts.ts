import 'server-only';
import nodemailer from 'nodemailer';
import type { EmailAccount, EmailPurpose } from '@prisma/client';
import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/secret-box';

/**
 * Resolving and dialling the mailboxes the platform sends from.
 *
 * Accounts are rows an admin edits (`EmailAccount`). The SMTP_* environment
 * variables still work and are used when no account matches, so an install that
 * never opens the admin screen keeps sending exactly as before — this is
 * additive, not a cutover.
 *
 * Nothing here is exported that returns a password. Transports are built inside
 * this module and only the transport escapes.
 */

/** How long a built transport is reused before being rebuilt, in ms. */
const TRANSPORT_TTL = 5 * 60 * 1000;

interface CachedTransport {
    transport: nodemailer.Transporter;
    /** Which account row this was built from, so an edit invalidates it. */
    fingerprint: string;
    builtAt: number;
}

const transports = new Map<string, CachedTransport>();

/** Everything an edit could change, so a stale transport is never reused. */
function fingerprintOf(account: EmailAccount) {
    return [
        account.smtpHost,
        account.smtpPort,
        account.smtpSecure,
        account.smtpUsername,
        account.smtpPassword,
        account.updatedAt.getTime(),
    ].join('|');
}

export interface ResolvedSender {
    transport: nodemailer.Transporter;
    from: string;
    /** Null when the environment fallback is in use. */
    accountId: string | null;
}

/**
 * Builds an SMTP transport from an account row.
 *
 * Exported for the admin "test connection" action, which needs to dial a set of
 * settings that may not be saved yet.
 */
export function buildSmtpTransport(settings: {
    host: string; port: number; secure: boolean; username: string; password: string;
}) {
    return nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        // Port 465 is implicit TLS from the first byte; anything else (587, 25)
        // starts plaintext and upgrades via STARTTLS. Getting this wrong makes
        // nodemailer hang waiting for a greeting the server never sends.
        secure: settings.secure,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        auth: { user: settings.username, pass: settings.password },
    });
}

function transportFor(account: EmailAccount) {
    const fingerprint = fingerprintOf(account);
    const cached = transports.get(account.id);
    if (cached && cached.fingerprint === fingerprint && Date.now() - cached.builtAt < TRANSPORT_TTL) {
        return cached.transport;
    }
    cached?.transport.close();

    const transport = buildSmtpTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        username: account.smtpUsername,
        password: decryptSecret(account.smtpPassword),
    });
    transports.set(account.id, { transport, fingerprint, builtAt: Date.now() });
    return transport;
}

/** Formats a From header, quoting the display name so commas cannot split it. */
function formatFrom(account: EmailAccount) {
    const name = account.fromName?.trim() || account.label.trim();
    return name ? `"${name.replace(/"/g, '')}" <${account.address}>` : account.address;
}

let envTransport: nodemailer.Transporter | null = null;

function environmentSender(): ResolvedSender {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
        throw new Error(
            'No email account is configured. Add one under Admin > Email accounts, '
            + 'or set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD in .env.',
        );
    }
    const port = Number(SMTP_PORT);
    envTransport ??= buildSmtpTransport({
        host: SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
        username: SMTP_USER,
        password: SMTP_PASSWORD,
    });
    return { transport: envTransport, from: process.env.SMTP_FROM || SMTP_USER, accountId: null };
}

/**
 * The account that should send a given kind of mail.
 *
 * Preference order: an active account for that exact purpose, then the default
 * account, then the environment. Falling through rather than failing is
 * deliberate — an admin adding a MARKETING mailbox should never be able to stop
 * verification codes going out.
 */
export async function resolveSender(purpose: EmailPurpose): Promise<ResolvedSender> {
    const account = await prisma.emailAccount.findFirst({
        where: { isActive: true, purpose },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }) ?? await prisma.emailAccount.findFirst({
        where: { isActive: true, isDefault: true },
    });

    if (!account) return environmentSender();
    return { transport: transportFor(account), from: formatFrom(account), accountId: account.id };
}

/** Sends one message through whichever account serves `purpose`. */
export async function sendMail(purpose: EmailPurpose, message: {
    to: string; subject: string; text: string; html?: string;
}) {
    const sender = await resolveSender(purpose);
    return sender.transport.sendMail({ from: sender.from, ...message });
}
