import 'dotenv/config';
import { eq, like } from 'drizzle-orm';
import { db, schema, closeDb } from '../lib/db';
import { buildWorkbook, readWorkbook, SpreadsheetError } from '../lib/spreadsheet';
import { LEAD_COLUMNS, PLAN_COLUMNS, exportLeads, exportPlans, importLeads, importPlans } from '../lib/spreadsheet-entities';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
    if (!ok) failed++;
}

const run = `zz${Date.now()}`;
const readAll = async (columns: typeof LEAD_COLUMNS, header: string[], rows: (string | number | null)[][]) => {
    const bytes = await buildWorkbook('Test', header.map((name) => ({ header: name })), rows);
    return readWorkbook(bytes, columns);
};
const read = async (columns: typeof LEAD_COLUMNS, header: string[], rows: (string | number | null)[][]) => (await readAll(columns, header, rows)).rows;

try {
    // file handling
    const parsed = await read(LEAD_COLUMNS, ['first name', 'EMAIL', 'Unknown'], [['Ada', '=HYPERLINK("http://x")', 'ignored']]);
    check('headers match ignoring case, unknown columns are dropped', parsed[0].values['First Name'] === 'Ada' && !('Unknown' in parsed[0].values));
    check('formula-looking text is kept as text', parsed[0].values.Email === '=HYPERLINK("http://x")');
    let refused = '';
    try { await readWorkbook(Buffer.from('a,b\n1,2'), LEAD_COLUMNS); } catch (error) { refused = error instanceof SpreadsheetError ? error.message : String(error); }
    check('a CSV renamed to .xlsx is refused', /\.xlsx/.test(refused), refused);
    let noHeaders = '';
    try { await read(LEAD_COLUMNS, ['Foo'], [['x']]); } catch (error) { noHeaders = error instanceof SpreadsheetError ? error.message : String(error); }
    check('a sheet with no known headers is refused', /No known columns/.test(noHeaders), noHeaders);

    // leads
    const email = `${run}@example.test`;
    const sheet = await read(LEAD_COLUMNS, ['First Name', 'Last Name', 'Email', 'Phone', 'Message', 'Status'], [
        ['Ada', 'Lovelace', email, '+4400', 'Hello', 'qualified'],
        ['Bad', 'Row', 'not-an-email', '', '', ''],
        ['Odd', 'Status', `b-${email}`, '', '', 'maybe'],
    ]);
    const first = await importLeads(sheet);
    check('valid lead rows are created, bad ones reported', first.created === 1 && first.errors.length === 2 && first.errors[0].line === 3, JSON.stringify(first));
    const again = await importLeads(sheet);
    check('importing the same file again creates nothing', again.created === 0 && again.skipped === 1, JSON.stringify(again));
    const stored = await db.query.lead.findFirst({ where: eq(schema.lead.email, email) });
    check('status is normalised and source is Imported', stored?.status === 'QUALIFIED' && stored?.source === 'IMPORT');
    const exported = await exportLeads();
    check('the export contains the imported lead', exported.some((row) => row[3] === email));
    const patch = await readAll(LEAD_COLUMNS, ['ID', 'First Name', 'Email', 'Status', 'Notes'], [[stored!.id, 'Ada', email, 'CONVERTED', 'called']]);
    const updated = await importLeads(patch.rows, new Set(patch.columns));
    const after = await db.query.lead.findFirst({ where: eq(schema.lead.id, stored!.id) });
    check('a row with an ID updates that lead', updated.updated === 1 && after?.status === 'CONVERTED' && after?.notes === 'called' && after.phone === '+4400' && after.lastName === 'Lovelace');

    // plans
    await db.insert(schema.product).values({ id: run, label: 'Test product', slug: run });
    const code = 'ZZ' + run.slice(-5).toUpperCase().replace(/[0-9]/g, 'A');
    const [currency] = await db.insert(schema.currency).values({ code, name: 'Test', symbol: 'T' }).returning();
    const planRows = await read(PLAN_COLUMNS, ['Product', 'Name', 'Price', 'Currency', 'RAM (MB)', 'Features', 'Active', 'Trial Days'], [
        [run, 'Starter', 19.5, code, 2048, 'One\nTwo', 'No', 14],
        ['missing-product', 'Nope', 1, '', '', '', '', ''],
        [run, 'Bad currency', 1, 'QQQQQQ', '', '', '', ''],
        [run, 'Negative', -5, '', '', '', '', ''],
    ]);
    const created = await importPlans(planRows);
    check('plan rows import and bad rows are reported', created.created === 1 && created.errors.length === 3, JSON.stringify(created));
    const plan = await db.query.plan.findFirst({ where: eq(schema.plan.productId, run) });
    check('plan fields are parsed', plan?.slug === 'starter' && plan.priceAmount === 19.5 && plan.currencyId === currency.id && plan.features.length === 2 && plan.isActive === false && plan.trialDays === 14);
    const partial = await readAll(PLAN_COLUMNS, ['Product', 'Name', 'Price'], [[run, 'Starter', 25]]);
    const reimport = await importPlans(partial.rows, new Set(partial.columns));
    const plan2 = await db.query.plan.findFirst({ where: eq(schema.plan.productId, run) });
    check('the same product and slug updates in place', reimport.updated === 1 && reimport.created === 0 && plan2?.priceAmount === 25 && plan2.id === plan!.id, JSON.stringify(reimport));
    check('columns missing from the sheet are left untouched', plan2?.currencyId === currency.id && plan2.ramMb === 2048 && plan2.features.length === 2 && plan2.isActive === false && plan2.trialDays === 14);
    check('the export contains the plan with its currency code', (await exportPlans()).some((row) => row[1] === run && row[7] === code));
} finally {
    await db.delete(schema.lead).where(like(schema.lead.email, `%${run}@example.test`));
    await db.delete(schema.plan).where(eq(schema.plan.productId, run));
    await db.delete(schema.product).where(eq(schema.product.id, run));
    await db.delete(schema.currency).where(like(schema.currency.code, 'ZZ%'));
    await closeDb();
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all spreadsheet checks passed');
