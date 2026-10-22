import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('Secure site setup storage is not configured.');
    return createHash('sha256').update(`unityalgo:site-order:v1:${secret}`).digest();
}
export function sealSiteSetup(orderOwner: string, setup: Record<string, unknown>) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(orderOwner));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(setup), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}
export function openSiteSetup(orderOwner: string, value: string): Record<string, unknown> {
    const [version, iv, tag, ciphertext] = value.split(':');
    if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Site setup could not be read.');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(orderOwner));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
