import 'dotenv/config';
import { closeDb, db, schema } from '../lib/db';

// Currencies whose conventional digit grouping is lakh/crore.
const LAKH_GROUPING = new Set(['INR', 'PKR', 'BDT', 'NPR', 'LKR']);

async function main() {
  const names = new Intl.DisplayNames(['en'], { type: 'currency' });
  const codes = Intl.supportedValuesOf('currency');
  const existing = new Set((await db.select({ code: schema.currency.code }).from(schema.currency)).map((c) => c.code));
  const symbolOf = (code: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? code;

  const fresh = codes.filter((code) => !existing.has(code));
  if (fresh.length) await db.insert(schema.currency).values(fresh.map((code) => ({
      code,
      name: names.of(code) ?? code,
      symbol: symbolOf(code),
      numberFormat: LAKH_GROUPING.has(code) ? '#,##,###.##' : '#,###.##',
      isActive: true,
      sortOrder: 100,
    }))).onConflictDoNothing();
  console.log(`Added ${fresh.length} currencies; ${existing.size} already existed; ${codes.length} in the ISO list.`);
}

main().finally(() => closeDb());
