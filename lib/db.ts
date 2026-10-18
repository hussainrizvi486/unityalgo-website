import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const globalForDb = globalThis as typeof globalThis & { pgPool?: Pool };
const pool = globalForDb.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

export const db = drizzle({ client: pool, schema: { ...schema, ...relations } });
export { schema };

export function isUniqueViolation(error: unknown): boolean {
  const code = error as { code?: string; cause?: { code?: string } } | null;
  return code?.code === '23505' || code?.cause?.code === '23505';
}

export function errorText(error: unknown): string {
  const e = error as { message?: string; cause?: { message?: string } } | null;
  return [e?.message, e?.cause?.message].filter(Boolean).join(' | ') || String(error);
}

export function one<T>(rows: T[], what = 'Record'): T {
  if (rows.length === 0) throw new Error(`${what} not found`);
  return rows[0];
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
