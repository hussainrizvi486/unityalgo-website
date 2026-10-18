import 'server-only';
import { headers } from 'next/headers';
import { eq, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export interface LimitState {
    count: number;
    resetAt: Date;
}

export async function hit(key: string, windowSeconds: number): Promise<LimitState> {
    const resetAt = new Date(Date.now() + windowSeconds * 1000);
    const table = schema.rateLimit;
    const [row] = await db
        .insert(table)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
            target: table.key,
            set: {
                count: sql`CASE WHEN ${table.resetAt} <= now() THEN 1 ELSE ${table.count} + 1 END`,
                resetAt: sql`CASE WHEN ${table.resetAt} <= now() THEN ${resetAt} ELSE ${table.resetAt} END`,
            },
        })
        .returning({ count: table.count, resetAt: table.resetAt });
    if (Math.random() < 0.01) await db.delete(table).where(lt(table.resetAt, new Date(Date.now() - 24 * 3600 * 1000))).catch(() => undefined);
    return row;
}

/** The current count for `key` without adding to it. */
export async function peek(key: string): Promise<LimitState> {
    const row = await db.query.rateLimit.findFirst({ where: eq(schema.rateLimit.key, key) });
    if (!row || row.resetAt.getTime() <= Date.now()) return { count: 0, resetAt: new Date(0) };
    return row;
}

export async function clear(key: string) {
    await db.delete(schema.rateLimit).where(eq(schema.rateLimit.key, key));
}

export function retryMessage(resetAt: Date) {
    const minutes = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 60_000));
    return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export async function clientIp() {
    const list = await headers();
    return list.get('x-forwarded-for')?.split(',')[0]?.trim() || list.get('x-real-ip')?.trim() || 'unknown';
}

export async function consume(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; message: string }> {
    const state = await hit(key, windowSeconds);
    return { allowed: state.count <= limit, message: retryMessage(state.resetAt) };
}
