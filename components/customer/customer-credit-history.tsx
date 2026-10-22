import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { currencyDigits } from '@/lib/billing-rules';

/** Server component: parent pages enforce customer ownership or admin access. */
export async function CustomerCreditHistory({ userId, admin = false }: { userId: string; admin?: boolean }) {
    const accounts = await db.query.creditAccount.findMany({ where: eq(schema.creditAccount.userId, userId) });
    if (!accounts.length) return null;
    const entries = await db.query.creditEntry.findMany({ where: inArray(schema.creditEntry.accountId, accounts.map((a) => a.id)), orderBy: desc(schema.creditEntry.createdAt), limit: 20 });
    const label: Record<string, string> = { GRANT: 'Credits added', RESERVE: 'Reserved for billing', CONSUME: 'Credits used', RELEASE: 'Credits returned', REVERSE: 'Credit correction' };
    return <section className="mt-6 rounded-xl border border-border p-5">
        <h2>Credit activity</h2>
        <ul className="mt-3 divide-y divide-border">
            {entries.map((entry) => {
                const currency = accounts.find((account) => account.id === entry.accountId)!.currency;
                return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div><p>{label[entry.kind] ?? entry.kind}</p><p className="text-muted-foreground">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(entry.createdAt)}{admin ? ` · ${entry.reason} · actor ${entry.actorId}` : ''}</p></div>
                    <span>{new Intl.NumberFormat('en', { style: 'currency', currency }).format(entry.amount / 10 ** currencyDigits(currency))}</span>
                </li>;
            })}
        </ul>
    </section>;
}
