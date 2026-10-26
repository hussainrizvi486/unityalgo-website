import 'server-only';
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { controller } from '@/lib/controller-client';
import { findAlgoSuitePlan } from '@/lib/products';
import { trialDaysFor, trialEligibility } from '@/lib/site-trials';
import { validateSiteWizard, type SiteWizardValues } from '@/lib/site-wizard';
import { sealSiteSetup, openSiteSetup } from '@/lib/site-order-secrets';
import { createPlanCheckout } from '@/lib/checkout-billing';
import { claimIdleSubscription } from '@/lib/subscription-claims';
import { upgradeTarget } from '@/lib/app-compatibility';
import { unionModules } from '@/lib/app-modules';
import { readPlanRestrictions } from '@/lib/plan-metadata';
import { loadPlanTiers } from '@/lib/app-plan-access';
import { asRecord, asString } from '@/lib/paddle-data';

export class SiteOrderError extends Error { }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureHosting(slug?: string) {
    const capabilities = await controller.sites.capabilities();
    if (!capabilities.configured || capabilities.accepting === false) throw new SiteOrderError('Site hosting is not ready. No payment will be requested until hosting is available.');
    if (slug && !(await controller.sites.checkSlug(slug)).available) throw new SiteOrderError('This site name is no longer available. Choose another name before paying.');
    return capabilities;
}

export async function saveSiteOrder(userId: string, requestKey: string, values: SiteWizardValues) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)) throw new SiteOrderError('Refresh the form and try again.');
    // Going Back from the payment page and submitting again carries a new request key but the same site name. An unpaid
    // draft takes the new details; a setup already in payment is never replaced (its name stays reserved), and the caller
    // sends the customer to resume it with `findResumableOrder`.
    const draftSameName = values.slug
        ? await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.userId, userId), sql`${schema.siteOrder.summary}->>'slug' = ${values.slug}`, eq(schema.siteOrder.status, 'DRAFT')) })
        : undefined;
    if (draftSameName) requestKey = draftSameName.requestKey;
    const saved = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.userId, userId), eq(schema.siteOrder.requestKey, requestKey)) });
    if (saved && saved.status !== 'DRAFT') return saved;
    const problems = Object.values(validateSiteWizard(values));
    if (problems.length) throw new SiteOrderError(problems[0]);
    const [plan, currency, capabilities] = await Promise.all([
        findAlgoSuitePlan(values.planId),
        db.query.currency.findFirst({ where: and(eq(schema.currency.code, values.currency), eq(schema.currency.isActive, true)) }),
        ensureHosting(values.slug),
    ]);
    if (!plan || !currency) throw new SiteOrderError('The selected plan or currency is unavailable.');
    const apps = values.apps.length ? await db.query.appCatalog.findMany({
        where: and(
            inArray(schema.appCatalog.id, values.apps), eq(schema.appCatalog.isActive, true), eq(schema.appCatalog.isInstallable, true),
            eq(schema.appCatalog.source, 'image'), or(isNull(schema.appCatalog.priceAmount), eq(schema.appCatalog.priceAmount, 0)),
            or(isNotNull(schema.appCatalog.frappeAppName), eq(schema.appCatalog.appType, 'module')),
        )
    }) : [];
    // A module entry needs no app in the image, only modules to switch on; an application must be one the hosting ships.
    const usable = (app: (typeof apps)[number]) => app.appType === 'module' ? app.modules.length > 0 : capabilities.apps.includes(app.frappeAppName!);
    if (apps.length !== new Set(values.apps).size || apps.some((app) => !usable(app))) throw new SiteOrderError('A selected application is unavailable.');
    const moduleApps = apps.filter((app) => app.appType === 'module');
    const tiers = await loadPlanTiers();
    const chosen = tiers.find((tier) => tier.id === plan.id);
    for (const app of apps) {
        const needed = upgradeTarget(app, chosen, tiers);
        if (needed) throw new SiteOrderError(`${app.name} needs the ${needed.name} plan or higher. Choose that plan or remove the app.`);
    }
    // Paid plan selection always goes through payment; only an explicitly free trial plan bypasses it.
    const trialDays = plan.priceAmount == null ? trialDaysFor(plan, await trialEligibility(userId)) : 0;
    if (!trialDays && (plan.priceAmount == null || !plan.paddlePriceId)) throw new SiteOrderError('This plan is not available for online purchase.');
    const restrictions = readPlanRestrictions(plan.metadata);
    const setup = {
        user_id: userId, request_key: requestKey, name: values.slug, slug: values.slug,
        app_names: apps.filter((app) => app.appType !== 'module').map((app) => app.frappeAppName), plan_id: plan.id,
        // The plan's modules and the chosen module entries are switched on after the site is set up, and the plan's roles go to its
        // administrator. The ids stay here to record which entries the site has.
        modules: unionModules([restrictions.modules, ...moduleApps.map((app) => app.modules)]), roles: restrictions.roles, module_app_ids: moduleApps.map((app) => app.id), plan_name: plan.name,
        plan_vcpu: plan.vcpu, plan_ram_mb: plan.ramMb, plan_storage_gb: plan.storageGb, plan_user_limit: plan.userLimit,
        company_name: values.companyName, country: values.country, currency: currency.code, coa_type: values.coaType,
        owner_email: values.email, owner_password: values.password, ...(trialDays ? { trial_days: trialDays } : {}),
    };
    return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`site-setup:${userId}:${requestKey}`}, 0))`);
        const existing = await tx.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.userId, userId), eq(schema.siteOrder.requestKey, requestKey)) });
        if (existing && existing.status !== 'DRAFT') return existing;
        const data = { planId: plan.id, priceId: plan.paddlePriceId, summary: { slug: values.slug, companyName: values.companyName, planName: plan.name }, encryptedSetup: sealSiteSetup(`${userId}:${requestKey}`, setup), trialDays, updatedAt: new Date() };
        if (existing) return (await tx.update(schema.siteOrder).set(data).where(eq(schema.siteOrder.id, existing.id)).returning())[0];
        return (await tx.insert(schema.siteOrder).values({ userId, requestKey, ...data }).returning())[0];
    });
}

/** The customer's own setup that is holding this site name, so they can be sent back to finish it. */
export async function findResumableOrder(userId: string, slug: string) {
    return db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.userId, userId), sql`${schema.siteOrder.summary}->>'slug' = ${slug}`, inArray(schema.siteOrder.status, ['DRAFT', 'AWAITING_PAYMENT', 'READY'])) });
}

export async function startSiteOrderPayment(userId: string, orderId: string, useCredits: boolean) {
    const order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, orderId), eq(schema.siteOrder.userId, userId)) });
    if (!order) throw new SiteOrderError('Site setup not found.');
    if (order.status === 'READY' || order.status === 'PROVISIONED') return { authorized: true };
    if (order.status === 'CANCELED' || order.status === 'EXPIRED') throw new SiteOrderError('This setup has ended. Start a new site setup.');
    await ensureHosting(asString(asRecord(order.summary).slug) ?? undefined);
    if (order.status === 'DRAFT') {
        const [frozen] = await db.update(schema.siteOrder).set({ status: 'AWAITING_PAYMENT', updatedAt: new Date() })
            .where(and(eq(schema.siteOrder.id, order.id), eq(schema.siteOrder.status, 'DRAFT'), eq(schema.siteOrder.updatedAt, order.updatedAt))).returning();
        if (!frozen) throw new SiteOrderError('Your setup changed. Refresh before continuing to payment.');
    }
    if (order.trialDays > 0) {
        const plan = await findAlgoSuitePlan(order.planId);
        if (!plan || trialDaysFor(plan, await trialEligibility(userId)) < 1) throw new SiteOrderError('This free trial is no longer available. Choose a paid plan.');
        const [ready] = await db.update(schema.siteOrder).set({ status: 'READY', updatedAt: new Date() }).where(and(eq(schema.siteOrder.id, order.id), eq(schema.siteOrder.status, 'AWAITING_PAYMENT'))).returning();
        if (!ready) throw new SiteOrderError('This setup has changed. Refresh before continuing.');
        return { authorized: true };
    }
    const plan = await findAlgoSuitePlan(order.planId);
    if (!plan?.paddlePriceId || plan.paddlePriceId !== order.priceId) throw new SiteOrderError('Plan pricing changed. Return to site setup before paying.');
    // A subscription the customer already pays for (for example after deleting a site) runs the new site: never charge twice.
    if (!order.paddleTransactionId && await claimIdleSubscription(userId, order)) return { authorized: true, claimed: true };
    const transactionId = await createPlanCheckout(userId, order.planId, useCredits, order.id);
    await db.update(schema.siteOrder).set({ status: 'AWAITING_PAYMENT', paddleTransactionId: transactionId, updatedAt: new Date() })
        .where(and(eq(schema.siteOrder.id, order.id), inArray(schema.siteOrder.status, ['DRAFT', 'AWAITING_PAYMENT'])));
    return { transactionId };
}

/** Called only with canonical provider transaction data inside billing synchronization. */
export async function confirmSiteOrderPayment(tx: Tx, data: Record<string, unknown>, userId: string) {
    if (data.status !== 'completed') return;
    const custom = asRecord(data.custom_data);
    const orderId = asString(custom.siteOrderId);
    if (!orderId) return;
    const operationId = asString(custom.billingOperationId);
    const operation = operationId ? await tx.query.billingOperation.findFirst({ where: eq(schema.billingOperation.id, operationId) }) : null;
    const order = await tx.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, orderId), eq(schema.siteOrder.userId, userId)) });
    if (!order || operation?.userId !== userId || asRecord(operation.request).siteOrderId !== orderId) throw new SiteOrderError('Site payment ownership is unresolved.');
    if (order.paidAt || order.status === 'PROVISIONED') return;
    if (['CANCELED', 'EXPIRED'].includes(order.status)) throw new SiteOrderError('Payment arrived for an ended setup; billing review is required.');
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length !== 1 || asRecord(items[0]).quantity !== 1 || asRecord(asRecord(items[0]).price).id !== order.priceId || !data.subscription_id) throw new SiteOrderError('The payment does not match the selected site plan.');
    const id = asString(data.id);
    if (!id || (order.paddleTransactionId && order.paddleTransactionId !== id)) throw new SiteOrderError('Site payment transaction mismatch.');
    const totals = asRecord(asRecord(data.details).totals);
    if (totals.balance !== '0') throw new SiteOrderError('Site payment is not fully settled.');
    if (order.status === 'PROVISIONED') return;
    await tx.update(schema.siteOrder).set({ status: 'READY', paidAt: new Date(), paddleTransactionId: id, error: null, updatedAt: new Date() }).where(eq(schema.siteOrder.id, order.id));
}

export async function provisionSiteOrder(orderId: string) {
    return db.transaction(async (tx) => {
        const locked = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${`site-order:${orderId}`}, 0)) as locked`);
        if (!locked.rows[0]?.locked) return;
        const order = await tx.query.siteOrder.findFirst({ where: eq(schema.siteOrder.id, orderId) });
        if (!order || order.status !== 'READY' || (!order.paidAt && order.trialDays < 1)) return;
        if (order.nextAttemptAt && order.nextAttemptAt > new Date()) return;
        if (!order.encryptedSetup) throw new SiteOrderError('Site setup details are unavailable.');
        try {
            const { module_app_ids: moduleAppIds, ...setup } = openSiteSetup(`${order.userId}:${order.requestKey}`, order.encryptedSetup) as Record<string, unknown> & { module_app_ids?: string[] };
            const site = await controller.sites.create(setup);
            if (moduleAppIds?.length) {
                // Record the module entries the site was created with, so removing or adding one later keeps the others.
                const existing = await tx.select({ id: schema.appCatalog.id }).from(schema.appCatalog).where(inArray(schema.appCatalog.id, moduleAppIds));
                if (existing.length) await tx.insert(schema.siteModuleApp).values(existing.map((app) => ({ siteId: site.id, appId: app.id, userId: order.userId }))).onConflictDoNothing();
            }
            await tx.update(schema.siteOrder).set({ status: 'PROVISIONED', siteId: site.id, encryptedSetup: null, error: null, updatedAt: new Date() }).where(eq(schema.siteOrder.id, order.id));
            await tx.update(schema.subscription).set({ siteId: site.id, appliedPlanId: order.planId, appliedAt: new Date() }).where(eq(schema.subscription.siteOrderId, order.id));
            await tx.insert(schema.notification).values({ userId: order.userId, eventKey: `site:${site.id}:created`, title: 'Site creation requested', body: 'Payment is confirmed and your site is being installed.', href: `/dashboard/sites/${site.id}` }).onConflictDoNothing();
        } catch {
            await tx.update(schema.siteOrder).set({ attempts: sql`${schema.siteOrder.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 60_000), error: 'Your site is queued. Hosting is temporarily unavailable; provisioning will retry without another payment.', updatedAt: new Date() }).where(eq(schema.siteOrder.id, order.id));
        }
    });
}
export async function drainSiteOrders(limit = 5) {
    const rows = await db.query.siteOrder.findMany({ where: and(eq(schema.siteOrder.status, 'READY'), or(isNull(schema.siteOrder.nextAttemptAt), sql`${schema.siteOrder.nextAttemptAt} <= timezone('UTC', now())`)), orderBy: asc(schema.siteOrder.updatedAt), limit });
    for (const order of rows) await provisionSiteOrder(order.id);
    return { attempted: rows.length };
}

/** Never release a site name while its payment outcome is uncertain. */
export async function cancelSiteOrder(userId: string, orderId: string, expired = false) {
    const order = await db.query.siteOrder.findFirst({ where: and(eq(schema.siteOrder.id, orderId), eq(schema.siteOrder.userId, userId)) });
    if (!order) throw new SiteOrderError('Site setup not found.');
    if (['CANCELED', 'EXPIRED'].includes(order.status)) return;
    if (!['DRAFT', 'AWAITING_PAYMENT'].includes(order.status)) throw new SiteOrderError('Paid or provisioning sites cannot be canceled here.');
    if (order.status === 'AWAITING_PAYMENT' && !order.trialDays) {
        // A setup frozen for payment whose checkout never got created (the payment could not be started) has nothing to
        // cancel at Paddle, and the customer must still be able to leave it. A checkout that was created, or one whose
        // outcome is unknown, goes through the careful path, which refuses when money may be involved.
        const started = await db.query.billingProviderRecord.findFirst({ where: eq(schema.billingProviderRecord.id, `checkout:${userId}:${order.id}`), columns: { id: true } });
        if (started || order.paddleTransactionId) {
            const { cancelPendingCheckout } = await import('@/lib/checkout-billing');
            await cancelPendingCheckout(userId, order.planId, order.id);
        }
    }
    const [ended] = await db.update(schema.siteOrder).set({ status: expired ? 'EXPIRED' : 'CANCELED', encryptedSetup: null, updatedAt: new Date() })
        .where(and(eq(schema.siteOrder.id, order.id), eq(schema.siteOrder.status, order.status), isNull(schema.siteOrder.paidAt))).returning();
    if (!ended) throw new SiteOrderError('The payment progressed. Refresh to check its status.');
}
export async function expireSiteOrders(limit = 25) {
    const orders = await db.query.siteOrder.findMany({ where: and(inArray(schema.siteOrder.status, ['DRAFT', 'AWAITING_PAYMENT']), sql`${schema.siteOrder.createdAt} < timezone('UTC', now()) - interval '24 hours'`), orderBy: asc(schema.siteOrder.updatedAt), limit });
    let expired = 0;
    for (const order of orders) {
        try { await cancelSiteOrder(order.userId, order.id, true); expired++; }
        catch {
            // Rotate uncertain orders while retaining their name and credentials for reconciliation.
            await db.update(schema.siteOrder).set({ updatedAt: new Date() }).where(eq(schema.siteOrder.id, order.id));
        }
    }
    return { attempted: orders.length, expired };
}

/** Recover local/browser-closed site payments even when a public webhook URL is not configured. */
export async function reconcilePendingSitePayments(limit = 5) {
    const { reconcilePaddleTransaction, reconcilePaddleSubscription } = await import('@/lib/paddle-sync');
    const orders = await db.query.siteOrder.findMany({ where: and(eq(schema.siteOrder.status, 'AWAITING_PAYMENT'), isNotNull(schema.siteOrder.paddleTransactionId)), orderBy: asc(schema.siteOrder.updatedAt), limit });
    let failed = 0;
    for (const order of orders) {
        try { await reconcilePaddleTransaction(order.paddleTransactionId!); } catch { failed++; }
        await db.update(schema.siteOrder).set({ updatedAt: new Date() }).where(eq(schema.siteOrder.id, order.id));
    }
    const upgrades = await db.query.subscription.findMany({ where: and(isNotNull(schema.subscription.siteId), isNotNull(schema.subscription.paddleSubscriptionId), sql`${schema.subscription.appliedPlanId} is distinct from ${schema.subscription.planId}`), orderBy: asc(schema.subscription.updatedAt), limit });
    for (const sub of upgrades) {
        try { await reconcilePaddleSubscription(sub.paddleSubscriptionId!); } catch { failed++; }
    }
    // Successful mutation can precede its webhook/local plan update.
    const operations = await db.query.billingOperation.findMany({ where: and(inArray(schema.billingOperation.status, ['SUCCEEDED', 'UNKNOWN']), sql`${schema.billingOperation.subscriptionId} like 'sub_%'`, sql`${schema.billingOperation.createdAt} > timezone('UTC', now()) - interval '1 hour'`), orderBy: asc(schema.billingOperation.updatedAt), limit });
    for (const operation of operations) {
        const sub = await db.query.subscription.findFirst({ where: and(eq(schema.subscription.paddleSubscriptionId, operation.subscriptionId), isNotNull(schema.subscription.siteId)) });
        if (sub && sub.appliedPlanId !== operation.planId) {
            try { await reconcilePaddleSubscription(operation.subscriptionId); } catch { failed++; }
        }
    }
    return { orders: orders.length, upgrades: upgrades.length, failed };
}
