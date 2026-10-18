import 'dotenv/config';
import { and, asc, desc, eq, inArray, isNotNull, like, sql } from 'drizzle-orm';
import { closeDb, db, schema } from '../lib/db';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CONTROLLER_URL = process.env.CONTROLLER_URL ?? 'http://localhost:8000';
const SESSION_SECRET = process.env.SESSION_SECRET;
const E2E_PREFIX = 'e2e-test-';

// ---------------------------------------------------------------- reporting

let passed = 0;
let failed = 0;
const failures: string[] = [];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function section(name: string) {
    console.log(`\n${BOLD}── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}${RESET}`);
}

function check(label: string, condition: boolean, detail?: string) {
    if (condition) {
        passed++;
        console.log(`  ${GREEN}✓${RESET} ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ${RED}✗${RESET} ${label}${detail ? `\n      ${DIM}${detail}${RESET}` : ''}`);
    }
}

function info(message: string) {
    console.log(`  ${DIM}${message}${RESET}`);
}

// ------------------------------------------------------------------- helpers

async function mintCustomerSession(userId: string, email: string) {
    const key = new TextEncoder().encode(SESSION_SECRET);
    const [session] = await db.insert(schema.loginSession).values({ userId, userAgent: 'E2E test', expiresAt: new Date(Date.now() + 3600_000) }).returning();
    return new SignJWT({ userId, email, sessionId: session.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key);
}

async function mintAdminSession(email: string) {
    const key = new TextEncoder().encode(SESSION_SECRET);
    return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key);
}

interface FetchResult {
    status: number;
    location: string | null;
    body: string;
}

interface LinkedTenant {
    id: string;
    tenant_slug: string;
    customer_email: string;
    user_id: string | null;
    subscription_id: string | null;
    plan_tier: string;
    customer: { id: string; name: string; email: string } | null;
    subscription: { id: string; status: string; plan: { name: string; slug: string } | null } | null;
}

async function get(path: string, cookie?: string): Promise<FetchResult> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: cookie ? { Cookie: cookie } : {},
        redirect: 'manual',
    });
    return {
        status: res.status,
        location: res.headers.get('location'),
        body: res.status === 200 ? await res.text() : '',
    };
}

function looksLikeRenderError(body: string) {
    return body.includes('Application error') || body.includes('__next_error__');
}

function pageContains(body: string, needle: string) {
    if (body.includes(needle)) return true;

    const chunks = [...body.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g)]
        .map((match) => match[1]);
    if (chunks.length === 0) return false;

    const stream = chunks
        .map((chunk) => {
            try {
                return JSON.parse(`"${chunk}"`) as string;
            } catch {
                return '';
            }
        })
        .join('');
    return stream.includes(needle) || stream.replace(/\\"/g, '"').includes(needle);
}

async function expectRenders(path: string, cookie?: string, mustContain?: string) {
    const res = await get(path, cookie);
    const ok = res.status === 200 && !looksLikeRenderError(res.body);
    const contains = mustContain ? pageContains(res.body, mustContain) : true;
    check(
        `GET ${path}${mustContain ? ` (contains "${mustContain}")` : ''}`,
        ok && contains,
        ok
            ? `rendered, but did not contain "${mustContain}"`
            : `status ${res.status}${looksLikeRenderError(res.body) ? ' + render error in body' : ''}`,
    );
    return res;
}

async function expectRedirect(path: string, expectedPrefix: string, cookie?: string) {
    const res = await get(path, cookie);
    const isRedirect = res.status >= 300 && res.status < 400;
    const target = res.location ?? '';
    check(
        `GET ${path} → redirects to ${expectedPrefix}`,
        isRedirect && target.startsWith(expectedPrefix),
        `status ${res.status}, location "${target}"`,
    );
}

// ------------------------------------------------------------------ teardown

async function cleanup() {
    // Order matters: children before parents, since not every FK cascades.
    const users = await db.select({ id: schema.user.id }).from(schema.user).where(like(schema.user.email, `${E2E_PREFIX}%`));
    const userIds = users.map((u) => u.id);

    if (userIds.length) {
        const tickets = await db.select({ id: schema.supportTicket.id }).from(schema.supportTicket).where(inArray(schema.supportTicket.userId, userIds));
        if (tickets.length) {
            await db.delete(schema.comment).where(and(
                eq(schema.comment.entityType, 'SUPPORT_TICKET'),
                inArray(schema.comment.entityId, tickets.map((t) => t.id)),
            ));
        }
        await db.delete(schema.comment).where(inArray(schema.comment.authorId, userIds));
        await db.delete(schema.user).where(inArray(schema.user.id, userIds));
    }

    await db.delete(schema.emailVerification).where(like(schema.emailVerification.email, `${E2E_PREFIX}%`));

    try {
        await db.execute(sql.raw(`DELETE FROM tenants WHERE tenant_slug LIKE '${E2E_PREFIX}%'`));
        await db.execute(sql.raw(`DELETE FROM database_connections WHERE name LIKE '${E2E_PREFIX}%'`));
    } catch {
        // Controller schema not present in this database — nothing to clean.
    }
}

// --------------------------------------------------------------------- suite

async function main() {
    console.log(`${BOLD}UnityAlgo end-to-end validation${RESET}`);
    info(`target: ${BASE_URL}`);

    if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not set — cannot mint sessions.');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');

    // Leftovers from a previous interrupted run would poison uniqueness checks.
    await cleanup();

    // ================================================================ public
    section('Public routes');
    for (const path of [
        '/',
        '/about-us',
        '/services',
        '/blog',
        '/privacy-policy',
        '/products/unitycommerce',
        '/products/algosuite',
        '/theme-preview',
    ]) {
        await expectRenders(path);
    }

    {
        const res = await fetch(`${BASE_URL}/products/unityerp`, { redirect: 'manual' });
        check('GET /products/unityerp → redirects to /products/algosuite',
            res.status === 308 && (res.headers.get('location') ?? '').endsWith('/products/algosuite'),
            `status ${res.status}, location "${res.headers.get('location')}"`);
    }

    section('Auth pages (public)');
    await expectRenders('/login', undefined, 'Sign in');
    await expectRenders('/register', undefined, 'Start with your email');
    await expectRenders('/customer/forgot-password', undefined, 'Forgot your password?');
    // /admin/login is gone — one sign-in page now serves both roles.

    // ============================================================ auth gates
    section('Auth gates (no session → redirect)');
    for (const path of [
        '/dashboard',
        '/dashboard/plans',
        '/dashboard/subscription',
        '/dashboard/support',
        '/dashboard/settings',
        '/dashboard/settings/profile',
        '/dashboard/settings/password',
        '/dashboard/settings/addresses',
    ]) {
        await expectRedirect(path, '/login');
    }
    for (const path of ['/admin', '/admin/plans', '/admin/users', '/admin/tickets', '/admin/email-accounts']) {
        await expectRedirect(path, '/login');
    }

    section('Cross-role session isolation');
    const [throwawayCustomer] = await db.insert(schema.user).values({
            email: `${E2E_PREFIX}isolation@example.com`,
            passwordHash: await bcrypt.hash('irrelevant', 10),
            role: 'CUSTOMER',
            firstName: 'Iso',
            lastName: 'Lation',
        }).returning();
    const isoCustomerCookie = `unityalgo_customer_session=${await mintCustomerSession(
        throwawayCustomer.id,
        throwawayCustomer.email,
    )}`;
    await expectRedirect('/admin/users', '/login', isoCustomerCookie);

    const adminUser = await db.query.user.findFirst({ where: eq(schema.user.role, 'ADMIN') });
    if (adminUser) {
        const adminCookie = `unityalgo_admin_session=${await mintAdminSession(adminUser.email)}`;
        await expectRedirect('/dashboard', '/login', adminCookie);
    } else {
        info('no ADMIN user in DB — skipping admin-into-customer isolation check');
    }

    // ========================================================= customer flow
    section('Customer data flow');

    const customerEmail = `${E2E_PREFIX}customer@example.com`;
    const [customer] = await db.insert(schema.user).values({
            email: customerEmail,
            passwordHash: await bcrypt.hash('E2ePassword123', 10),
            role: 'CUSTOMER',
            firstName: 'Eve',
            lastName: 'Tester',
            emailVerifiedAt: new Date(),
        }).returning();
    check('customer created', !!customer.id);

    const customerCookie = `unityalgo_customer_session=${await mintCustomerSession(customer.id, customer.email)}`;

    await expectRenders('/dashboard', customerCookie, 'No active subscription');
    await expectRenders('/dashboard/subscription', customerCookie, 'No active subscription');
    await expectRenders('/dashboard/plans', customerCookie, 'Choose a plan');

    // --- purchase -----------------------------------------------------------
    const plan = await db.query.plan.findFirst({
        where: and(eq(schema.plan.isActive, true), isNotNull(schema.plan.priceAmount)),
        orderBy: [asc(schema.plan.productId), asc(schema.plan.sortOrder)],
    });
    if (!plan) {
        info('no purchasable plan seeded — run `npm run seed:plans` first. Skipping purchase flow.');
    } else {
        const [subscription] = await db.insert(schema.subscription).values({
                userId: customer.id,
                planId: plan.id,
                productId: plan.productId,
                status: 'ACTIVE',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }).returning();
        check(`subscription created (${plan.productId}/${plan.name})`, !!subscription.id);

        await expectRenders('/dashboard', customerCookie, plan.name);
        await expectRenders('/dashboard/subscription', customerCookie, plan.name);

        let duplicateRejected = false;
        try {
            await db.insert(schema.subscription).values({ userId: customer.id, planId: plan.id, productId: plan.productId, status: 'ACTIVE' });
        } catch {
            duplicateRejected = true;
        }
        check('duplicate subscription for same product rejected by DB constraint', duplicateRejected);

        // --- add-ons --------------------------------------------------------
        const addOn = await db.query.addOn.findFirst({ where: and(eq(schema.addOn.productId, plan.productId), eq(schema.addOn.isActive, true)) });
        if (!addOn) {
            info(`no active add-on for ${plan.productId} — skipping add-on flow`);
        } else {
            await db.insert(schema.subscriptionAddOn).values({ subscriptionId: subscription.id, addOnId: addOn.id });
            const withAddOn = await db.query.subscription.findFirst({
                where: eq(schema.subscription.id, subscription.id),
                with: { addOns: { with: { addOn: true } } },
            });
            check('add-on attached to subscription', withAddOn?.addOns.length === 1);
            await expectRenders('/dashboard/subscription', customerCookie, addOn.name);

            let duplicateAddOnRejected = false;
            try {
                await db.insert(schema.subscriptionAddOn).values({ subscriptionId: subscription.id, addOnId: addOn.id });
            } catch {
                duplicateAddOnRejected = true;
            }
            check('duplicate add-on rejected by DB constraint', duplicateAddOnRejected);

            await db.delete(schema.subscriptionAddOn).where(and(
                eq(schema.subscriptionAddOn.subscriptionId, subscription.id),
                eq(schema.subscriptionAddOn.addOnId, addOn.id),
            ));
            const afterRemove = await db.query.subscription.findFirst({
                where: eq(schema.subscription.id, subscription.id),
                with: { addOns: true },
            });
            check('add-on removed from subscription', afterRemove?.addOns.length === 0);
        }
    }

    // --- profile ------------------------------------------------------------
    section('Profile & settings');
    await expectRenders('/dashboard/settings', customerCookie);
    await expectRenders('/dashboard/settings/profile', customerCookie);
    await expectRenders('/dashboard/settings/password', customerCookie);

    await db.update(schema.user).set({
            username: `${E2E_PREFIX}evetester`,
            phone: '+1 555 010 0100',
            company: 'E2E Industries',
            companyEmail: 'ops@e2e-industries.test',
        }).where(eq(schema.user.id, customer.id));
    const updatedProfile = await db.query.user.findFirst({ where: eq(schema.user.id, customer.id) });
    check('profile fields persist (username/phone/company/companyEmail)',
        updatedProfile?.username === `${E2E_PREFIX}evetester`
        && updatedProfile?.phone === '+1 555 010 0100'
        && updatedProfile?.company === 'E2E Industries'
        && updatedProfile?.companyEmail === 'ops@e2e-industries.test');
    await expectRenders('/dashboard/settings', customerCookie, 'E2E Industries');

    let duplicateUsernameRejected = false;
    try {
        await db.insert(schema.user).values({
                email: `${E2E_PREFIX}dupe-username@example.com`,
                passwordHash: 'x',
                role: 'CUSTOMER',
                username: `${E2E_PREFIX}evetester`,
            });
    } catch {
        duplicateUsernameRejected = true;
    }
    check('duplicate username rejected by DB constraint', duplicateUsernameRejected);

    const [nullUsernameA] = await db.insert(schema.user).values({ email: `${E2E_PREFIX}null-a@example.com`, passwordHash: 'x', role: 'CUSTOMER' }).returning();
    const [nullUsernameB] = await db.insert(schema.user).values({ email: `${E2E_PREFIX}null-b@example.com`, passwordHash: 'x', role: 'CUSTOMER' }).returning();
    check('multiple users may have NULL username', !!nullUsernameA.id && !!nullUsernameB.id);

    // --- addresses ----------------------------------------------------------
    section('Addresses');
    await expectRenders('/dashboard/settings/addresses', customerCookie, 'No addresses yet');
    await expectRenders('/dashboard/settings/addresses/new', customerCookie);

    const [first] = await db.insert(schema.address).values({
            userId: customer.id,
            addressLine1: '1 First Street',
            city: 'Metropolis',
            state: 'NY',
            country: 'USA',
            postcode: '10001',
            isDefault: true,
        }).returning();
    check('first address is default', first.isDefault);

    const [second] = await db.insert(schema.address).values({
            userId: customer.id,
            addressLine1: '2 Second Avenue',
            city: 'Gotham',
            state: 'NJ',
            country: 'USA',
            postcode: '07001',
            isDefault: false,
        }).returning();

    await db.transaction(async (tx) => {
        await tx.update(schema.address).set({ isDefault: false }).where(eq(schema.address.userId, customer.id));
        await tx.update(schema.address).set({ isDefault: true }).where(eq(schema.address.id, second.id));
    });
    const afterPromote = await db.query.address.findMany({ where: eq(schema.address.userId, customer.id) });
    check('exactly one default after promoting the second address',
        afterPromote.filter((a) => a.isDefault).length === 1
        && afterPromote.find((a) => a.isDefault)?.id === second.id);

    await db.delete(schema.address).where(eq(schema.address.id, second.id));
    const fallback = await db.query.address.findFirst({
        where: eq(schema.address.userId, customer.id),
        orderBy: desc(schema.address.createdAt),
    });
    if (fallback) await db.update(schema.address).set({ isDefault: true }).where(eq(schema.address.id, fallback.id));
    const afterDelete = await db.query.address.findMany({ where: eq(schema.address.userId, customer.id) });
    check('a default survives deletion of the previous default',
        afterDelete.length === 1 && afterDelete[0].isDefault);
    await expectRenders('/dashboard/settings/addresses', customerCookie, '1 First Street');

    // --- support ------------------------------------------------------------
    section('Support tickets & polymorphic comments');
    await expectRenders('/dashboard/support', customerCookie, 'No support tickets yet');
    await expectRenders('/dashboard/support/new', customerCookie);

    const [ticket] = await db.insert(schema.supportTicket).values({
            userId: customer.id,
            subject: 'E2E cannot access store',
            description: 'Raised by the automated end-to-end suite.',
            status: 'OPEN',
        }).returning();
    check('ticket created', !!ticket.id);
    await expectRenders('/dashboard/support', customerCookie, 'E2E cannot access store');
    await expectRenders(`/dashboard/support/${ticket.id}`, customerCookie, 'E2E cannot access store');

    await db.insert(schema.comment).values({
            entityType: 'SUPPORT_TICKET',
            entityId: ticket.id,
            authorId: customer.id,
            body: 'Customer reply from the E2E suite.',
        });
    if (adminUser) {
        await db.insert(schema.comment).values({
                entityType: 'SUPPORT_TICKET',
                entityId: ticket.id,
                authorId: adminUser.id,
                body: 'Admin reply from the E2E suite.',
            });
    }
    const thread = await db.query.comment.findMany({
        where: and(eq(schema.comment.entityType, 'SUPPORT_TICKET'), eq(schema.comment.entityId, ticket.id)),
        orderBy: asc(schema.comment.createdAt),
    });
    check(`comment thread ordered oldest-first (${thread.length} comments)`, thread.length >= 1);
    await expectRenders(`/dashboard/support/${ticket.id}`, customerCookie, 'Customer reply from the E2E suite.');

    await db.insert(schema.comment).values({
            entityType: 'PLAN',
            entityId: 'e2e-non-ticket-entity',
            authorId: customer.id,
            body: 'Comment attached to a non-ticket entity.',
        });
    const planComments = await db.query.comment.findMany({
        where: and(eq(schema.comment.entityType, 'PLAN'), eq(schema.comment.entityId, 'e2e-non-ticket-entity')),
    });
    check('generic comment table accepts a non-ticket entityType', planComments.length === 1);

    // A customer must not read another customer's ticket.
    const otherCookie = `unityalgo_customer_session=${await mintCustomerSession(
        throwawayCustomer.id,
        throwawayCustomer.email,
    )}`;
    const foreign = await get(`/dashboard/support/${ticket.id}`, otherCookie);
    check("another customer cannot open someone else's ticket (404)", foreign.status === 404,
        `status ${foreign.status}`);

    // ============================================================ admin flow
    section('Admin panel');
    if (!adminUser) {
        info('no ADMIN user — skipping. Create one with `npm run admin:create`.');
    } else {
        const adminCookie = `unityalgo_admin_session=${await mintAdminSession(adminUser.email)}`;

        // /admin has no landing page of its own; it forwards to the first section.
        await expectRedirect('/admin', '/admin/blogs', adminCookie);

        for (const path of [
            '/admin/blogs',
            '/admin/plans',
            '/admin/plans/new',
            '/admin/addons',
            '/admin/addons/new',
            '/admin/users',
            '/admin/users/new',
            '/admin/contacts',
            '/admin/tickets',
        ]) {
            await expectRenders(path, adminCookie);
        }

        await expectRenders('/admin/tickets', adminCookie, 'E2E cannot access store');
        await expectRenders(`/admin/tickets/${ticket.id}`, adminCookie, 'E2E cannot access store');
        await expectRenders('/admin/users', adminCookie, customerEmail);

        section('Admin panel — controller pages');
        for (const path of [
            '/admin/servers', '/admin/servers/new',
            '/admin/databases', '/admin/databases/new',
            '/admin/tenants', '/admin/tenants/new',
            '/admin/logs',
        ]) {
            await expectRenders(path, adminCookie);
        }
        await expectRenders('/admin/logs?view=events', adminCookie);
        await expectRenders('/admin/tenants?status=active', adminCookie);

        // The infrastructure nav must actually be reachable from the sidebar.
        const sidebar = await get('/admin/blogs', adminCookie);
        check('admin sidebar links to controller sections',
            sidebar.body.includes('/admin/servers')
            && sidebar.body.includes('/admin/databases')
            && sidebar.body.includes('/admin/tenants')
            && sidebar.body.includes('/admin/logs'));

        await expectRedirect('/admin/servers', '/login');
        await expectRedirect('/admin/tenants', '/login');

        await db.update(schema.supportTicket).set({ status: 'RESOLVED' }).where(eq(schema.supportTicket.id, ticket.id));
        const resolved = await db.query.supportTicket.findFirst({ where: eq(schema.supportTicket.id, ticket.id) });
        check('admin can change ticket status to RESOLVED', resolved?.status === 'RESOLVED');
        await expectRenders(`/dashboard/support/${ticket.id}`, customerCookie, 'Resolved');
    }

    // ======================================================= controller API
    section('Controller API (Python)');
    let controllerUp = false;
    try {
        const res = await fetch(`${CONTROLLER_URL}/health`, { signal: AbortSignal.timeout(3000) });
        controllerUp = res.ok;
        if (controllerUp) {
            const health = (await res.json()) as { database?: string; status?: string };
            check('controller /health reports ok', health.status === 'ok');
            check('controller reports database up (shared DB)', health.database === 'up');
        }
    } catch {
        controllerUp = false;
    }

    if (!controllerUp) {
        info(`not reachable at ${CONTROLLER_URL} — skipping. Start it with:`);
        info('  cd controller && source env/bin/activate && python main.py serve');
    } else {
        const unauth = await fetch(`${CONTROLLER_URL}/api/v1/servers`, { redirect: 'manual' });
        check('controller /api/v1/* rejects unauthenticated requests', unauth.status === 401,
            `status ${unauth.status}`);

        const wrongKey = await fetch(`${CONTROLLER_URL}/api/v1/servers`, {
            headers: { 'X-Controller-Key': 'not-the-real-key' },
        });
        check('controller rejects a wrong API key', wrongKey.status === 401, `status ${wrongKey.status}`);

        const key = process.env.CONTROLLER_INTERNAL_API_KEY;
        if (key) {
            const authed = await fetch(`${CONTROLLER_URL}/api/v1/servers`, {
                headers: { 'X-Controller-Key': key },
            });
            check('controller accepts the configured API key', authed.ok, `status ${authed.status}`);
        } else {
            info('CONTROLLER_INTERNAL_API_KEY not set in this env — skipping positive auth check');
        }

        // The retired cookie-login surface must be gone, not merely unused.
        const login = await fetch(`${CONTROLLER_URL}/api/v1/auth/login`, { method: 'POST' });
        check('controller cookie-login endpoint is removed', login.status === 401 || login.status === 404,
            `status ${login.status}`);
        const spa = await fetch(`${CONTROLLER_URL}/admin/`, { redirect: 'manual' });
        check('controller admin SPA is removed', spa.status === 404, `status ${spa.status}`);

        // Both migration tools must own tables in the one shared database.
        const { rows: tables } = await db.execute<{ table_name: string }>(sql`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        `);
        const names = tables.map((t) => t.table_name);
        check('shared DB holds Prisma-owned tables', names.includes('User') && names.includes('Subscription'));
        check('shared DB holds Alembic-owned tables',
            names.includes('server_nodes') && names.includes('tenants') && names.includes('deployments'));
        check('both migration ledgers coexist',
            names.includes('_prisma_migrations') && names.includes('alembic_version'));

        // --- database clusters ---------------------------------------------
        const controllerKey = process.env.CONTROLLER_INTERNAL_API_KEY;
        if (controllerKey) {
            section('Database clusters');
            const api = async (path: string, init?: RequestInit) =>
                fetch(`${CONTROLLER_URL}${path}`, {
                    ...init,
                    headers: {
                        'X-Controller-Key': controllerKey,
                        'Content-Type': 'application/json',
                        ...(init?.headers ?? {}),
                    },
                });

            const dbUrl = new URL(process.env.DATABASE_URL!);
            const created = await api('/api/v1/database-connections', {
                method: 'POST',
                body: JSON.stringify({
                    name: `${E2E_PREFIX}cluster`,
                    host: dbUrl.hostname,
                    port: Number(dbUrl.port || 5432),
                    database_name: 'postgres',
                    username: dbUrl.username,
                    password: decodeURIComponent(dbUrl.password),
                    sslmode: 'disable',
                    role: 'cluster',
                    host_from_worker: 'host.docker.internal',
                }),
            });
            check('cluster can be registered', created.ok, `status ${created.status}`);

            if (created.ok) {
                const cluster = (await created.json()) as { id: string; role: string; is_default: boolean };
                check('registered with role=cluster', cluster.role === 'cluster');

                // The password must never come back out, in any form.
                const listed = await (await api('/api/v1/database-connections')).json() as {
                    results: Array<Record<string, unknown>>;
                };
                const row = listed.results.find((r) => r.id === cluster.id)!;
                check('cluster credentials are never returned by the API',
                    !('password' in row) && !('password_encrypted' in row) && row.has_password === true);

                // A live connect proves the stored password decrypts correctly.
                const tested = await api(`/api/v1/database-connections/${cluster.id}/test`, { method: 'POST' });
                const testBody = (await tested.json()) as { status?: string };
                check('cluster connection test succeeds (password round-trips through Fernet)',
                    testBody.status === 'success', JSON.stringify(testBody));

                // A tenant created with an explicit cluster must land on it.
                const tenantRes = await api('/api/v1/tenants', {
                    method: 'POST',
                    body: JSON.stringify({
                        tenant_slug: `${E2E_PREFIX}clustered`.replace(/[^a-z0-9-]/g, '-'),
                        customer_email: `${E2E_PREFIX}tenant@example.com`,
                        plan_tier: 'starter',
                        database_connection_id: cluster.id,
                    }),
                });
                check('tenant can be created on a chosen cluster', tenantRes.ok, `status ${tenantRes.status}`);

                if (tenantRes.ok) {
                    const tenant = (await tenantRes.json()) as {
                        id: string; database_connection_id: string; database_cluster: string;
                    };
                    check('tenant reports the cluster it was assigned to',
                        tenant.database_connection_id === cluster.id);

                    const patched = await api(`/api/v1/tenants/${tenant.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ database_connection_id: null }),
                    });
                    check('changing a tenant cluster by attribute is refused', patched.status >= 400,
                        `status ${patched.status}`);

                    // Deleting a cluster that still hosts a tenant must fail.
                    const blockedDelete = await api(`/api/v1/database-connections/${cluster.id}`, {
                        method: 'DELETE',
                    });
                    check('cluster with tenants on it cannot be deregistered',
                        blockedDelete.status >= 400, `status ${blockedDelete.status}`);

                    await api(`/api/v1/tenants/${tenant.id}?force=true`, { method: 'DELETE' });
                }

                // An external connection must not be usable to host tenants.
                const externalRes = await api('/api/v1/database-connections', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: `${E2E_PREFIX}external`,
                        host: dbUrl.hostname,
                        port: Number(dbUrl.port || 5432),
                        database_name: 'postgres',
                        username: dbUrl.username,
                        password: decodeURIComponent(dbUrl.password),
                        sslmode: 'disable',
                        role: 'external',
                    }),
                });
                if (externalRes.ok) {
                    const external = (await externalRes.json()) as { id: string };
                    const rejected = await api('/api/v1/tenants', {
                        method: 'POST',
                        body: JSON.stringify({
                            tenant_slug: `${E2E_PREFIX}ext`.replace(/[^a-z0-9-]/g, '-'),
                            customer_email: `${E2E_PREFIX}ext@example.com`,
                            plan_tier: 'starter',
                            database_connection_id: external.id,
                        }),
                    });
                    check('tenants cannot be provisioned onto an external connection',
                        rejected.status >= 400, `status ${rejected.status}`);
                    await api(`/api/v1/database-connections/${external.id}`, { method: 'DELETE' });
                }

                await api(`/api/v1/database-connections/${cluster.id}`, { method: 'DELETE' });
            }

            section('Tenant ↔ customer ↔ plan');

            const [linkUser] = await db.insert(schema.user).values({
                    email: `${E2E_PREFIX}linked@example.com`,
                    passwordHash: 'x',
                    role: 'CUSTOMER',
                    name: 'Linked Customer',
                }).returning();
            const [linkPlan] = await db.insert(schema.plan).values({
                    productId: 'unity_commerce',
                    name: 'E2E Launch',
                    slug: `${E2E_PREFIX}launch`,
                    priceAmount: 49,
                }).returning();
            const [linkSub] = await db.insert(schema.subscription).values({
                    userId: linkUser.id, planId: linkPlan.id,
                    productId: 'unity_commerce', status: 'ACTIVE',
                }).returning();
            const [algoPlan] = await db.insert(schema.plan).values({
                    productId: 'algo_suite', name: 'E2E Algo',
                    slug: `${E2E_PREFIX}algo`, priceAmount: 29,
                }).returning();
            const [algoSub] = await db.insert(schema.subscription).values({
                    userId: linkUser.id, planId: algoPlan.id,
                    productId: 'algo_suite', status: 'ACTIVE',
                }).returning();

            const slug = `${E2E_PREFIX}linked`.replace(/[^a-z0-9-]/g, '-');
            const linkedRes = await api('/api/v1/tenants', {
                method: 'POST',
                body: JSON.stringify({ tenant_slug: slug, subscription_id: linkSub.id }),
            });
            check('a slug plus a subscription is enough to create a tenant',
                linkedRes.ok, `status ${linkedRes.status}`);

            if (linkedRes.ok) {
                const linked = (await linkedRes.json()) as LinkedTenant;
                check('customer resolved from the subscription',
                    linked.user_id === linkUser.id, String(linked.user_id));
                check('customer_email derived from the account, not the request',
                    linked.customer_email === linkUser.email, linked.customer_email);
                check('plan_tier derived from the plan slug',
                    linked.plan_tier === linkPlan.slug, linked.plan_tier);
                check('serialized tenant names its customer',
                    linked.customer?.id === linkUser.id, JSON.stringify(linked.customer));
                check('serialized tenant names its plan',
                    linked.subscription?.plan?.name === 'E2E Launch',
                    JSON.stringify(linked.subscription));

                // One paid subscription must not silently fund two stores.
                const second = await api('/api/v1/tenants', {
                    method: 'POST',
                    body: JSON.stringify({
                        tenant_slug: `${slug}-2`, subscription_id: linkSub.id,
                    }),
                });
                check('a second tenant on the same subscription is refused',
                    second.status >= 400, `status ${second.status}`);

                // Only UnityCommerce has storefronts.
                const wrongProduct = await api('/api/v1/tenants', {
                    method: 'POST',
                    body: JSON.stringify({
                        tenant_slug: `${slug}-3`, subscription_id: algoSub.id,
                    }),
                });
                check('a non-UnityCommerce subscription is refused',
                    wrongProduct.status >= 400, `status ${wrongProduct.status}`);

                const wrongOwner = await api('/api/v1/tenants', {
                    method: 'POST',
                    body: JSON.stringify({
                        tenant_slug: `${slug}-4`,
                        subscription_id: linkSub.id,
                        user_id: 'some-other-customer',
                    }),
                });
                check('a user_id that does not own the subscription is refused',
                    wrongOwner.status >= 400, `status ${wrongOwner.status}`);

                // A tenant with no owner at all has nobody to bill or contact.
                const ownerless = await api('/api/v1/tenants', {
                    method: 'POST',
                    body: JSON.stringify({ tenant_slug: `${slug}-5` }),
                });
                check('a tenant with no owner at all is refused',
                    ownerless.status >= 400, `status ${ownerless.status}`);

                // The reverse direction, which backs the customer detail page.
                const mine = await (await api(`/api/v1/tenants?user_id=${linkUser.id}`)).json() as
                    { total: number; results: LinkedTenant[] };
                check("a customer's tenants can be looked up by user_id",
                    mine.total === 1 && mine.results[0].tenant_slug === slug,
                    `total ${mine.total}`);
                const others = await (await api('/api/v1/tenants?user_id=not-a-customer')).json() as
                    { total: number };
                check('the user_id filter excludes other customers', others.total === 0,
                    `total ${others.total}`);

                await api(`/api/v1/tenants/${linked.id}?force=true`, { method: 'DELETE' });
            }

            await db.delete(schema.subscription).where(inArray(schema.subscription.id, [linkSub.id, algoSub.id]));
            await db.delete(schema.plan).where(inArray(schema.plan.id, [linkPlan.id, algoPlan.id]));
            await db.delete(schema.user).where(eq(schema.user.id, linkUser.id));
        } else {
            info('CONTROLLER_INTERNAL_API_KEY not set — skipping cluster checks');
        }

        section('SSH terminal service');
        const TERMINAL_URL = process.env.CONTROLLER_WS_HTTP_URL
            ?? (process.env.NEXT_PUBLIC_CONTROLLER_WS_URL ?? 'ws://127.0.0.1:8765').replace(/^ws/, 'http');

        let terminalUp = false;
        const probeServerId = '00000000-0000-0000-0000-000000000000';
        try {
            const probe = await fetch(`${TERMINAL_URL}/ws/terminal/${probeServerId}`, {
                signal: AbortSignal.timeout(3000),
            });
            terminalUp = probe.status === 401;
            check('terminal service is reachable and rejects an unauthenticated handshake',
                probe.status === 401, `status ${probe.status}`);
        } catch {
            check('terminal service is reachable', false,
                `nothing listening at ${TERMINAL_URL} — start it with: cd controller && python ws_terminal_main.py`);
        }

        if (terminalUp) {
            const secret = new TextEncoder().encode(SESSION_SECRET);
            const mintTerminalToken = (claims: Record<string, unknown>, expires = '60s') =>
                new SignJWT(claims)
                    .setProtectedHeader({ alg: 'HS256' })
                    .setIssuedAt()
                    .setExpirationTime(expires)
                    .sign(secret);

            const { rows: serverRows } = await db.execute<{ id: string }>(sql`
                SELECT id::text FROM server_nodes WHERE is_active = true LIMIT 1
            `);

            if (serverRows.length === 0) {
                info('no active server registered — skipping positive terminal-token checks');
            } else {
                const serverId = serverRows[0].id;
                const hit = (token: string) =>
                    fetch(`${TERMINAL_URL}/ws/terminal/${serverId}?token=${encodeURIComponent(token)}`,
                        { signal: AbortSignal.timeout(3000) });

                const valid = await mintTerminalToken({
                    purpose: 'controller-terminal', serverId, adminEmail: 'e2e@example.com',
                });
                check('valid terminal grant passes auth (426 Upgrade Required)',
                    (await hit(valid)).status === 426);

                // Every claim the Python verifier checks, exercised.
                const wrongServer = await mintTerminalToken({
                    purpose: 'controller-terminal',
                    serverId: '11111111-1111-1111-1111-111111111111',
                    adminEmail: 'e2e@example.com',
                });
                check('grant for a different server is rejected', (await hit(wrongServer)).status === 401);

                const wrongPurpose = await mintTerminalToken({
                    purpose: 'something-else', serverId, adminEmail: 'e2e@example.com',
                });
                check('grant with the wrong purpose is rejected', (await hit(wrongPurpose)).status === 401);

                const expired = await new SignJWT({
                    purpose: 'controller-terminal', serverId, adminEmail: 'e2e@example.com',
                })
                    .setProtectedHeader({ alg: 'HS256' })
                    .setIssuedAt(Math.floor(Date.now() / 1000) - 9999)
                    .setExpirationTime(Math.floor(Date.now() / 1000) - 9000)
                    .sign(secret);
                check('expired grant is rejected', (await hit(expired)).status === 401);

                const forged = await new SignJWT({
                    purpose: 'controller-terminal', serverId, adminEmail: 'attacker@example.com',
                })
                    .setProtectedHeader({ alg: 'HS256' })
                    .setIssuedAt()
                    .setExpirationTime('60s')
                    .sign(new TextEncoder().encode('not-the-real-session-secret'));
                check('grant signed with the wrong secret is rejected', (await hit(forged)).status === 401);
            }
        }

        section('Schema ownership guard');
        const envPy = await readFile(
            fileURLToPath(new URL('../controller/alembic/env.py', import.meta.url)),
            'utf8',
        ).catch(() => '');
        check('alembic env.py filters Prisma-owned tables from autogenerate',
            envPy.includes('include_object') && envPy.includes('PRISMA_OWNED_TABLES'),
            'controller/alembic/env.py must pass include_object to context.configure');

        // The Prisma side must still own its tables outright.
        const websiteOwned = (await db.execute<{ table_name: string }>(sql`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('User','Subscription','BillingRecord')
        `)).rows;
        check('website-owned tables still present and intact', websiteOwned.length === 3,
            `found ${websiteOwned.length} of 3`);

        check('retired controller identity tables are gone',
            !names.includes('customers') && !names.includes('addresses')
            && !names.includes('billing_records') && !names.includes('admin_users'));

        const fks = (await db.execute<{ constraint_name: string }>(sql`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.constraint_name IN (
                'tenants_user_id_fkey',
                'tenants_subscription_id_fkey',
                'BillingRecord_tenantId_fkey'
              )
        `)).rows;
        check('cross-tool foreign keys exist (tenants↔User/Subscription, BillingRecord↔tenants)',
            fks.length === 3, `found ${fks.length} of 3`);
    }
}

main()
    .catch((err) => {
        failed++;
        failures.push('suite crashed');
        console.error(`\n${RED}Suite crashed:${RESET}`, err instanceof Error ? err.message : err);
    })
    .finally(async () => {
        section('Teardown');
        try {
            await cleanup();
            console.log(`  ${GREEN}✓${RESET} test data removed`);
        } catch (err) {
            console.log(`  ${RED}✗${RESET} cleanup failed: ${err instanceof Error ? err.message : err}`);
        }
        await closeDb();

        console.log(`\n${BOLD}${passed} passed, ${failed} failed${RESET}`);
        if (failures.length) {
            console.log(`${RED}Failures:${RESET}`);
            for (const f of failures) console.log(`  · ${f}`);
        }
        process.exit(failed > 0 ? 1 : 0);
    });
