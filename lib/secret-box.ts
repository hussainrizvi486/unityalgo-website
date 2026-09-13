import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption for secrets kept in our own database.
 *
 * Mail account passwords have to be recoverable — nodemailer needs the actual
 * password to authenticate — so they cannot be hashed the way a user password
 * is. They are encrypted instead, with the key held outside the database in
 * `CREDENTIAL_ENCRYPTION_KEY`. That is what makes a leaked database dump
 * useless on its own.
 *
 * AES-256-GCM rather than CBC: it authenticates as well as encrypts, so a
 * ciphertext altered in the database fails to decrypt instead of silently
 * yielding different plaintext. The controller does the same job with Fernet
 * on the Python side (`DatabaseConnection.password_encrypted`); this is the
 * Node equivalent, deliberately kept to one small module so there is one place
 * to audit and one place to rotate.
 */

/** Output format marker, so the scheme can change without ambiguity later. */
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
/** GCM's standard nonce length. */
const IV_BYTES = 12;

function getKey() {
    const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error(
            'CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with '
            + '`openssl rand -base64 32` and add it to .env — see .env.example.',
        );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        throw new Error(
            `CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes for AES-256, got ${key.length}. `
            + 'Generate one with `openssl rand -base64 32`.',
        );
    }
    return key;
}

/** Whether secrets can be stored at all — lets the UI say so plainly. */
export function encryptionIsConfigured() {
    try {
        getKey();
        return true;
    } catch {
        return false;
    }
}

export function encryptSecret(plaintext: string) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    // Nonce and tag are not secret, and both are needed to decrypt, so they
    // travel with the ciphertext rather than in separate columns.
    return [
        VERSION,
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        body.toString('base64url'),
    ].join('.');
}

export function decryptSecret(payload: string) {
    const [version, iv, tag, body] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !body) {
        throw new Error('Stored secret is not in the expected format.');
    }
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

/**
 * A hint like `••••••••ab`, for showing that a secret exists without revealing
 * it. Nothing outside this module should ever hand a password to a client.
 */
export function maskSecret(plaintext: string) {
    if (plaintext.length <= 2) return '••••••••';
    return `••••••••${plaintext.slice(-2)}`;
}
