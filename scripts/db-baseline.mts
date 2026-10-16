/**
 * Marks the Drizzle baseline migration (0000) as already applied, for a database that existed before
 * Drizzle took over from Prisma.
 *
 *   npm run db:baseline     # once, on an existing database
 *   npm run db:migrate      # then apply anything newer
 *
 * 0000 describes tables that Prisma already created, so running it would fail. A brand-new database should
 * NOT run this: `npm run db:migrate` creates the tables itself. Safe to repeat; it does nothing when the
 * database has no website tables yet, or the baseline is already recorded.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { closeDb, db } from '../lib/db';

const dir = new URL('../db/migrations/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', dir), 'utf8')) as { entries: { idx: number; when: number; tag: string }[] };
const baseline = journal.entries.find((entry) => entry.idx === 0);
if (!baseline) throw new Error('db/migrations has no baseline migration.');
if (!readdirSync(dir).includes(`${baseline.tag}.sql`)) throw new Error(`Missing ${baseline.tag}.sql.`);

// Drizzle identifies an applied migration by the SHA-256 of its SQL file and the journal's timestamp.
const hash = createHash('sha256').update(readFileSync(new URL(`${baseline.tag}.sql`, dir), 'utf8')).digest('hex');

const { rows: existing } = await db.execute<{ present: boolean }>(sql`SELECT to_regclass('public."User"') IS NOT NULL AS present`);
if (!existing[0]?.present) {
    console.log('No website tables yet: nothing to baseline. Run `npm run db:migrate` to create them.');
} else {
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
    const { rows: recorded } = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`);
    if (recorded[0].n > 0) console.log('Baseline already recorded.');
    else {
        await db.execute(sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${baseline.when})`);
        console.log(`Recorded baseline ${baseline.tag} as applied.`);
    }
}
await closeDb();
