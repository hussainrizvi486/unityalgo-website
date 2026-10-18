import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const DIAGNOSES: { test: (code: string, message: string) => boolean; advice: string }[] = [
    { test: (code) => code === '28P01', advice: 'The database rejected the username or password. Check the user and password in DATABASE_URL.' },
    { test: (code, message) => code === '3D000' || /database ".*" does not exist/i.test(message), advice: 'The server is reachable but has no database with that name. Create it (createdb) or correct the database name in DATABASE_URL.' },
    { test: (code, message) => /role ".*" does not exist/i.test(message), advice: 'The database user in DATABASE_URL does not exist on that server. Create the role or correct the username.' },
    { test: (code, message) => code === '28000' || /pg_hba\.conf/i.test(message), advice: 'The server refused this machine or user (pg_hba.conf). Allow this host on the database server, or connect with SSL if it requires it.' },
    { test: (_code, message) => /server does not support ssl/i.test(message), advice: 'The server does not support SSL but the connection asked for it. Add sslmode=disable to DATABASE_URL.' },
    { test: (_code, message) => /ssl/i.test(message), advice: 'The SSL handshake failed. If the server requires SSL add sslmode=require to DATABASE_URL; if it has none use sslmode=disable.' },
    { test: (code) => code === 'ENOTFOUND' || code === 'EAI_AGAIN', advice: 'The database host name could not be resolved. Check the host in DATABASE_URL, your DNS and any VPN.' },
    { test: (code) => code === 'ECONNREFUSED', advice: 'Nothing is accepting connections at that host and port. Check PostgreSQL is running (for example `docker compose up -d db`) and that the host and port in DATABASE_URL are right.' },
    { test: (code, message) => code === 'ETIMEDOUT' || /timeout/i.test(message), advice: 'The database host did not answer in time. Check the host and port, that PostgreSQL is running, and that a firewall is not blocking the port.' },
    { test: (code) => code === 'EHOSTUNREACH' || code === 'ENETUNREACH', advice: 'There is no network route to the database host. Check your network or VPN.' },
    { test: (code) => code === '53300', advice: 'The server is out of connections. Close idle clients or raise max_connections on the database.' },
    { test: (code) => code === '57P03', advice: 'PostgreSQL is still starting or recovering. Wait a moment and start the site again.' },
];

export function diagnoseConnectionError(error: unknown): string {
    const { code = '', message = '' } = (error ?? {}) as { code?: string; message?: string };
    const inner = (error as { errors?: { code?: string }[] } | null)?.errors?.[0];
    const found = DIAGNOSES.find((entry) => entry.test(code || inner?.code || '', message));
    return found?.advice ?? 'The connection failed for a reason this check does not recognise. The database error is shown above.';
}

/** DATABASE_URL with the password hidden, safe to print. */
export function safeDatabaseUrl(url: string | undefined): string {
    if (!url) return '(DATABASE_URL is not set)';
    try {
        const parsed = new URL(url);
        if (parsed.password) parsed.password = '***';
        return parsed.toString();
    } catch {
        return '(DATABASE_URL is not a valid URL)';
    }
}

export interface StartupReport {
    ok: boolean;
    lines: string[];
}

function shippedMigrations(): number | null {
    try {
        const journal = JSON.parse(readFileSync(join(process.cwd(), 'db', 'migrations', 'meta', '_journal.json'), 'utf8'));
        return Array.isArray(journal.entries) ? journal.entries.length : null;
    } catch {
        return null;
    }
}

export async function runDatabaseStartupCheck(url = process.env.DATABASE_URL): Promise<StartupReport> {
    const target = safeDatabaseUrl(url);
    if (!url) {
        return { ok: false, lines: [`Database connection FAILED: ${target}`, '  diagnosis: Set DATABASE_URL in .env to the PostgreSQL connection string.'] };
    }
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
        await client.connect();
        await client.query('SELECT 1');
        const lines = [`Database connection OK: ${target}`];
        const shipped = shippedMigrations();
        if (shipped != null) {
            const applied = await client
                .query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')
                .then((result) => result.rows[0].count as number)
                .catch(() => null);          // the table does not exist yet: nothing has been migrated
            if (applied == null || applied < shipped) {
                lines.push(`  warning: ${applied ?? 0} of ${shipped} migrations are applied. Run \`npm run db:migrate\`.`);
            }
        }
        return { ok: true, lines };
    } catch (error) {
        const e = error as { message?: string; errors?: { message?: string }[] };
        const detail = (e.message || e.errors?.[0]?.message || String(error)).split('\n')[0];
        return {
            ok: false,
            lines: [`Database connection FAILED: ${target}`, `  error:     ${detail}`, `  diagnosis: ${diagnoseConnectionError(error)}`],
        };
    } finally {
        await client.end().catch(() => undefined);
    }
}

export async function checkDatabaseOnStartup() {
    const mode = (process.env.DB_STARTUP_CHECK || 'warn').toLowerCase();
    if (mode === 'off') return;
    const report = await runDatabaseStartupCheck();
    const print = report.ok ? console.log : console.error;
    print(`[db] ${report.lines.join('\n[db] ')}`);
    if (!report.ok && mode === 'strict') {
        console.error('[db] DB_STARTUP_CHECK=strict: stopping because the database is unreachable.');
        process.exit(1);
    }
}
