import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

// One pool for the whole process. In development Next.js reloads modules, so it is kept on globalThis
// instead of being rebuilt (and leaking connections) on every edit.
const globalForDb = globalThis as typeof globalThis & { pgPool?: Pool };
const pool = globalForDb.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

export const db = drizzle({ client: pool, schema: { ...schema, ...relations } });
export { schema };

/**
 * True when `error` is Postgres' unique-constraint violation (SQLSTATE 23505). Drizzle wraps driver errors in
 * a DrizzleQueryError whose `cause` is the original, so look there as well as on the error itself.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code = error as { code?: string; cause?: { code?: string } } | null;
  return code?.code === '23505' || code?.cause?.code === '23505';
}

/**
 * The error's own message plus the database's (Drizzle's message is only "Failed query: ...", while the
 * constraint name that callers match on lives in `cause`).
 */
export function errorText(error: unknown): string {
  const e = error as { message?: string; cause?: { message?: string } } | null;
  return [e?.message, e?.cause?.message].filter(Boolean).join(' | ') || String(error);
}

/**
 * The first row of an INSERT/UPDATE ... RETURNING, or a thrown error when there is none. The old ORM's
 * `update` and `delete` threw when no row matched; Drizzle returns an empty list, so call sites that relied on
 * the throw (inside a try, to show "could not save") use this to keep it.
 */
export function one<T>(rows: T[], what = 'Record'): T {
  if (rows.length === 0) throw new Error(`${what} not found`);
  return rows[0];
}

/** Closes the connections so a one-off script can exit (a pool keeps the process alive). */
export async function closeDb(): Promise<void> {
  await pool.end();
}
