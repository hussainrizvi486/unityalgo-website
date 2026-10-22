import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

/** Assigned allowances are recorded here; they cannot be deposited into Paddle's native balance. */
export async function grantCustomerCredit(input: {
    userId: string; currency: string; amount: number; actorId: string; reason: string; operationKey: string;
}) {
    if (!/^[A-Z]{3}$/.test(input.currency) || !Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 2_147_483_647) {
        throw new Error('Credit must be a positive integer amount in currency minor units.');
    }
    if (!input.reason.trim() || input.reason.length > 1000 || !input.operationKey || input.operationKey.length > 200) {
        throw new Error('A reason and unique operation key are required.');
    }
    return db.transaction(async (tx) => {
        // Serializes both account creation and duplicate grants, including different currencies.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credit:${input.userId}`}, 0))`);
        const duplicate = await tx.query.creditEntry.findFirst({ where: eq(schema.creditEntry.operationKey, input.operationKey) });
        if (duplicate) {
            const account = await tx.query.creditAccount.findFirst({ where: eq(schema.creditAccount.id, duplicate.accountId) });
            if (account?.userId !== input.userId || account.currency !== input.currency || duplicate.amount !== input.amount || duplicate.actorId !== input.actorId || duplicate.reason !== input.reason || duplicate.kind !== 'GRANT') {
                throw new Error('This operation key has already been used for another credit.');
            }
            return duplicate;
        }
        await tx.insert(schema.creditAccount).values({ userId: input.userId, currency: input.currency }).onConflictDoNothing();
        const [account] = await tx.update(schema.creditAccount)
            .set({ available: sql`${schema.creditAccount.available} + ${input.amount}` })
            .where(and(eq(schema.creditAccount.userId, input.userId), eq(schema.creditAccount.currency, input.currency))).returning();
        const [entry] = await tx.insert(schema.creditEntry).values({
            accountId: account.id, amount: input.amount, kind: 'GRANT', actorId: input.actorId,
            reason: input.reason, operationKey: input.operationKey,
        }).returning();
        return entry;
    });
}

export type CreditTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Only server-owned billing operations may reserve credits. Amounts are in invoice-discount minor units. */
export async function reserveCustomerCredits(input: {
    userId: string; currency: string; maximum: number; operationId: string;
    kind: 'CHECKOUT' | 'UPGRADE' | 'RENEWAL'; subscriptionId?: string;
}) {
    if (!Number.isSafeInteger(input.maximum) || input.maximum < 0) throw new Error('Invalid credit reservation amount.');
    return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credit:${input.userId}`}, 0))`);
        const existing = await tx.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.operationId, input.operationId) });
        if (existing) {
            if (existing.userId !== input.userId || existing.currency !== input.currency || existing.kind !== input.kind || existing.status !== 'RESERVED') throw new Error('Credit operation is already finalized or does not match.');
            return existing;
        }
        const operation = await tx.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, input.operationId) });
        if (!operation || operation.userId !== input.userId || !['PROCESSING', 'QUOTED'].includes(operation.status)) throw new Error('Credit reservation requires an owned billing operation.');
        const account = await tx.query.creditAccount.findFirst({ where: and(eq(schema.creditAccount.userId, input.userId), eq(schema.creditAccount.currency, input.currency)) });
        const amount = Math.min(account?.available ?? 0, input.maximum);
        if (!account || !amount) return null;
        await tx.update(schema.creditAccount).set({ available: sql`${schema.creditAccount.available} - ${amount}`, reserved: sql`${schema.creditAccount.reserved} + ${amount}` }).where(eq(schema.creditAccount.id, account.id));
        const [redemption] = await tx.insert(schema.creditRedemption).values({
            operationId: input.operationId, accountId: account.id, userId: input.userId, kind: input.kind,
            currency: input.currency, reservedAmount: amount, paddleSubscriptionId: input.subscriptionId,
        }).returning();
        await tx.insert(schema.creditEntry).values({ accountId: account.id, operationKey: `reserve:${redemption.id}`, kind: 'RESERVE', amount, actorId: input.userId, reason: `Reserved for ${input.kind.toLowerCase()}` });
        return redemption;
    });
}

/** Caller must first prove that any attached provider discount can no longer be used. */
export async function releaseCustomerCredits(tx: CreditTx, redemptionId: string) {
    const held = await tx.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, redemptionId) });
    if (!held) throw new Error('Credit reservation not found.');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credit:${held.userId}`}, 0))`);
    const current = await tx.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, redemptionId) });
    if (!current || current.status !== 'RESERVED') return;
    if (current.cleanupRequired) throw new Error('Provider discount must be removed before credits are released.');
    await tx.update(schema.creditAccount).set({ available: sql`${schema.creditAccount.available} + ${current.reservedAmount}`, reserved: sql`${schema.creditAccount.reserved} - ${current.reservedAmount}` }).where(eq(schema.creditAccount.id, current.accountId));
    await tx.insert(schema.creditEntry).values({ accountId: current.accountId, operationKey: `release:${current.id}`, kind: 'RELEASE', amount: current.reservedAmount, actorId: current.userId, reason: 'Unused billing credits returned' });
    await tx.update(schema.creditRedemption).set({ status: 'RELEASED', updatedAt: new Date() }).where(eq(schema.creditRedemption.id, current.id));
}

/** Atomically consume only the discount recorded by Paddle, releasing any unused reservation. */
export async function settleCustomerCredits(tx: CreditTx, input: { redemptionId: string; transactionId: string; currency: string; discountAmount: number }) {
    const held = await tx.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, input.redemptionId) });
    if (!held) throw new Error('Credit reservation not found.');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credit:${held.userId}`}, 0))`);
    const current = await tx.query.creditRedemption.findFirst({ where: eq(schema.creditRedemption.id, input.redemptionId) });
    if (!current || current.currency !== input.currency || !Number.isSafeInteger(input.discountAmount) || input.discountAmount < 0 || input.discountAmount > current.reservedAmount) throw new Error('Provider discount does not match reserved credits.');
    if (current.status === 'SETTLED') {
        if (current.paddleTransactionId !== input.transactionId || current.consumedAmount !== input.discountAmount) throw new Error('Credit discount was used by more than one transaction.');
        return;
    }
    if (current.status !== 'RESERVED') throw new Error('Released credits cannot be consumed.');
    if (current.paddleTransactionId && current.paddleTransactionId !== input.transactionId) throw new Error('Credit transaction mismatch.');
    const unused = current.reservedAmount - input.discountAmount;
    await tx.update(schema.creditAccount).set({ available: sql`${schema.creditAccount.available} + ${unused}`, reserved: sql`${schema.creditAccount.reserved} - ${current.reservedAmount}` }).where(eq(schema.creditAccount.id, current.accountId));
    if (input.discountAmount) await tx.insert(schema.creditEntry).values({ accountId: current.accountId, operationKey: `consume:${current.id}`, kind: 'CONSUME', amount: input.discountAmount, actorId: current.userId, reason: `Plan credits applied to ${input.transactionId}` });
    if (unused) await tx.insert(schema.creditEntry).values({ accountId: current.accountId, operationKey: `unused:${current.id}`, kind: 'RELEASE', amount: unused, actorId: current.userId, reason: 'Unused portion of billing reservation returned' });
    await tx.update(schema.creditRedemption).set({ status: 'SETTLED', consumedAmount: input.discountAmount, paddleTransactionId: input.transactionId, updatedAt: new Date() }).where(eq(schema.creditRedemption.id, current.id));
}
