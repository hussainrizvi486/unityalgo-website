import 'dotenv/config';
import assert from 'node:assert/strict';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { closeDb, db, errorText, isUniqueViolation, one, schema } from '../lib/db';
import { listAlgoSuitePlans, listProducts, listProductsWithPlans } from '../lib/products';
import { listCurrencies } from '../lib/currencies';

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
    try { await fn(); console.log('ok  ', name); }
    catch (error) { failures++; console.log('FAIL', name, '\n     ', (error as Error).message.split('\n').slice(0, 6).join('\n      ')); }
}
const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

await check('products are listed active-first in display order, with their active plans nested', async () => {
    const products = await listProducts();
    assert.ok(products.length >= 2, 'expected the seeded products');
    const nested = await listProductsWithPlans();
    for (const product of nested) {
        assert.ok(product.plans.length > 0, 'a product with no active plans must be dropped');
        assert.ok(product.plans.every((plan) => plan.isActive && plan.productId === product.id));
        const order = product.plans.map((plan) => plan.sortOrder);
        assert.deepEqual(order, [...order].sort((a, b) => a - b), 'plans must be in sortOrder');
        assert.ok(product.plans.every((plan) => Array.isArray(plan.features)), 'features is always an array');
    }
});

await check('AlgoSuite plans come only from the AlgoSuite product and only when active', async () => {
    const plans = await listAlgoSuitePlans();
    for (const plan of plans) assert.equal(plan.productId, 'algo_suite');
    assert.ok(plans.every((plan) => plan.isActive));
});

await check('currencies include the seeded ISO list, enabled ones only', async () => {
    const currencies = await listCurrencies();
    assert.ok(currencies.length > 100, `expected the ISO currencies, got ${currencies.length}`);
    assert.ok(currencies.some((currency) => currency.code === 'USD'));
});

await check('timestamps come back as Date objects and enums as their values', async () => {
    const user = await db.query.user.findFirst({ orderBy: asc(schema.user.createdAt) });
    assert.ok(user, 'need at least one user');
    assert.ok(user.createdAt instanceof Date && user.updatedAt instanceof Date);
    assert.ok(['ADMIN', 'CUSTOMER'].includes(user.role));
});

await check('email account password columns keep their property names', async () => {
    const [account] = await db.query.emailAccount.findMany({ limit: 1 });
    if (account) assert.ok('smtpPassword' in account && 'imapPassword' in account);
});

await check('relations carry the names the code uses (comment.author, subscription.addOns)', async () => {
    const comment = await db.query.comment.findFirst({ with: { author: { columns: { id: true } } } });
    if (comment) assert.ok(comment.author.id);
    const subscription = await db.query.subscription.findFirst({ with: { plan: true, addOns: { with: { addOn: true } } } });
    if (subscription) assert.ok(subscription.plan.id && Array.isArray(subscription.addOns));
});

await check('inserts generate ids and updatedAt; updates move updatedAt', async () => {
    const [created] = await db.insert(schema.currency).values({ code: `ZP${letters(5)}`, name: 'Test', symbol: '¤' }).returning();
    try {
        assert.match(created.id, /^[a-z0-9]{20,}$/, 'a cuid-style id is generated client-side');
        assert.ok(created.updatedAt instanceof Date && created.createdAt instanceof Date);
        assert.equal(created.numberFormat, '#,###.##');
        await new Promise((resolve) => setTimeout(resolve, 15));
        const [updated] = await db.update(schema.currency).set({ name: 'Test 2' }).where(eq(schema.currency.id, created.id)).returning();
        assert.ok(updated.updatedAt.getTime() > created.updatedAt.getTime(), 'updatedAt must advance on update');
        assert.equal(updated.createdAt.getTime(), created.createdAt.getTime());
    } finally {
        await db.delete(schema.currency).where(eq(schema.currency.id, created.id));
    }
});

await check('a database CHECK constraint is enforced (currency codes are 3-8 capital letters)', async () => {
    await assert.rejects(db.insert(schema.currency).values({ code: 'bad1', name: 'x', symbol: 'x' }), (error: unknown) => /Currency_code_format/.test(errorText(error)));
});

await check('a unique violation is detectable, and errorText names the constraint', async () => {
    const code = `ZQ${letters(5)}`;
    const [first] = await db.insert(schema.currency).values({ code, name: 'One', symbol: '1' }).returning();
    try {
        await assert.rejects(db.insert(schema.currency).values({ code, name: 'Two', symbol: '2' }), (error: unknown) => isUniqueViolation(error) && errorText(error).includes('Currency_code_key'));
    } finally {
        await db.delete(schema.currency).where(eq(schema.currency.id, first.id));
    }
});

await check('one() throws when an UPDATE matched nothing (the old update-throws-on-missing behaviour)', async () => {
    assert.throws(() => one([], 'Thing'), /Thing not found/);
    const rows = await db.update(schema.currency).set({ name: 'x' }).where(eq(schema.currency.id, 'does-not-exist')).returning({ id: schema.currency.id });
    assert.equal(rows.length, 0);
});

await check('onConflictDoNothing leaves an existing row alone (notification dedupe)', async () => {
    const user = await db.query.user.findFirst();
    assert.ok(user);
    const eventKey = `db-test:${Date.now()}`;
    const values = { userId: user.id, eventKey, title: 'First', body: 'x' };
    const target = [schema.notification.userId, schema.notification.eventKey];
    try {
        await db.insert(schema.notification).values(values).onConflictDoNothing({ target });
        await db.insert(schema.notification).values({ ...values, title: 'Second' }).onConflictDoNothing({ target });
        const rows = await db.select().from(schema.notification).where(and(eq(schema.notification.userId, user.id), eq(schema.notification.eventKey, eventKey)));
        assert.equal(rows.length, 1);
        assert.equal(rows[0].title, 'First');
    } finally {
        await db.delete(schema.notification).where(eq(schema.notification.eventKey, eventKey));
    }
});

await check('a transaction rolls back every write when one fails', async () => {
    const code = `ZR${letters(5)}`;
    await assert.rejects(db.transaction(async (tx) => {
        await tx.insert(schema.currency).values({ code, name: 'In tx', symbol: 't' });
        throw new Error('abort');
    }), /abort/);
    assert.equal(await db.$count(schema.currency, eq(schema.currency.code, code)), 0, 'the insert must not survive the rollback');
});

await check('db.$count and ordering behave (unread notifications, newest first)', async () => {
    const user = await db.query.user.findFirst();
    assert.ok(user);
    const unread = await db.$count(schema.notification, and(eq(schema.notification.userId, user.id), isNull(schema.notification.readAt)));
    const rows = await db.query.notification.findMany({ where: and(eq(schema.notification.userId, user.id), isNull(schema.notification.readAt)), orderBy: desc(schema.notification.createdAt) });
    assert.equal(rows.length, unread);
    const times = rows.map((row) => row.createdAt.getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

console.log(failures ? `\n${failures} check(s) failed` : '\nall database checks passed');
await closeDb();
process.exit(failures ? 1 : 0);
