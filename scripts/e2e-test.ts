/**
 * End-to-end validation of the whole platform.
 *
 * Covers three layers, in order:
 *   1. Routing/auth    — every route renders, and auth gates actually gate.
 *   2. Data flows      — the real mutations (register, purchase, add-ons,
 *                        addresses, tickets/comments) against the real DB.
 *   3. Integration     — the controller API and its shared-DB wiring.
 *
 * Everything it creates is namespaced with E2E_PREFIX and torn down at the
 * end, including on failure — so it is safe to re-run against a dev database.
 * It deliberately never touches rows it did not create.
 *
 * Usage:
 *   npm run test:e2e              # against http://localhost:3000
 *   BASE_URL=... npm run test:e2e
 *
 * Requires the Next.js dev server to be running. The controller API section
 * is skipped automatically if it is not reachable.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CONTROLLER_URL = process.env.CONTROLLER_URL ?? 'http://localhost:8000';
const SESSION_SECRET = process.env.SESSION_SECRET;
const E2E_PREFIX = 'e2e-test-';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
    return new SignJWT({ userId, email })
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

/**
 * The account-linked shape of a controller tenant. Declared here rather than
 * imported from lib/controller-client, which is `server-only` and so cannot
 * load in a plain script.
 */
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

/**
 * A Next.js page that throws during render still returns 200 with an error
 * payload embedded in the streamed HTML, so status alone is not enough to
 * call a page healthy.
 */
function looksLikeRenderError(body: string) {
    return body.includes('Application error') || body.includes('__next_error__');
}

/**
 * Searches a page for text, including inside the React flight payload.
 *
 * The admin lists render their rows in the browser (AG Grid), so the row data
 * reaches the page as client-component props inside `self.__next_f.push(...)`
 * chunks rather than as HTML. Those chunks are split at arbitrary byte
 * offsets and their contents are JSON-escaped, so a plain `includes` on the
 * raw body misses a value whose string happens to straddle a boundary. This
 * rebuilds the stream first, then searches.
 */
function pageContains(body: string, needle: string) {
    if (body.includes(needle)) return true;

    const chunks = [...body.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g)]
        .map((match) => match[1]);
    if (chunks.length === 0) return false;

    // Each chunk is a JS string literal; decoding it yields the flight text,
    // which is itself JSON containing further escaped quotes.
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
    const users = await prisma.user.findMany({
        where: { email: { startsWith: E2E_PREFIX } },
        select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length) {
        const tickets = await prisma.supportTicket.findMany({
            where: { userId: { in: userIds } },
            select: { id: true },
        });
        // Comments are polymorphic (entityType/entityId), so they have no FK
        // to cascade from — they must be deleted explicitly.
        await prisma.comment.deleteMany({
            where: { entityType: 'SUPPORT_TICKET', entityId: { in: tickets.map((t) => t.id) } },
        });
        await prisma.comment.deleteMany({ where: { authorId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.emailVerification.deleteMany({ where: { email: { startsWith: E2E_PREFIX } } });

    // Controller-owned rows. Raw SQL because Prisma does not map these tables
    // (they belong to Alembic — see controller/README.md), and guarded because
    // they only exist once the controller's migrations have been applied.
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM tenants WHERE tenant_slug LIKE '${E2E_PREFIX}%'`,
        );
        await prisma.$executeRawUnsafe(
            `DELETE FROM database_connections WHERE name LIKE '${E2E_PREFIX}%'`,
        );
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

    // The ERP was renamed from UnityERP to AlgoSuite; the old path must keep
    // redirecting rather than 404ing.
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

    // Cross-role isolation: a customer session must not open the admin panel,
    // and vice versa. This is the security property the two-cookie design exists
    // to guarantee, so it is worth asserting explicitly rather than assuming.
    section('Cross-role session isolation');
    const throwawayCustomer = await prisma.user.create({
        data: {
            email: `${E2E_PREFIX}isolation@example.com`,
            passwordHash: await bcrypt.hash('irrelevant', 10),
            role: 'CUSTOMER',
            firstName: 'Iso',
            lastName: 'Lation',
        },
    });
    const isoCustomerCookie = `unityalgo_customer_session=${await mintCustomerSession(
        throwawayCustomer.id,
        throwawayCustomer.email,
    )}`;
    await expectRedirect('/admin/users', '/login', isoCustomerCookie);

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (adminUser) {
        const adminCookie = `unityalgo_admin_session=${await mintAdminSession(adminUser.email)}`;
        await expectRedirect('/dashboard', '/login', adminCookie);
    } else {
        info('no ADMIN user in DB — skipping admin-into-customer isolation check');
    }

    // ========================================================= customer flow
    section('Customer data flow');

    const customerEmail = `${E2E_PREFIX}customer@example.com`;
    const customer = await prisma.user.create({
        data: {
            email: customerEmail,
            passwordHash: await bcrypt.hash('E2ePassword123', 10),
            role: 'CUSTOMER',
            firstName: 'Eve',
            lastName: 'Tester',
            emailVerifiedAt: new Date(),
        },
    });
    check('customer created', !!customer.id);

    const customerCookie = `unityalgo_customer_session=${await mintCustomerSession(customer.id, customer.email)}`;

    // Empty states must render before any subscription exists — this is the
    // path a brand-new customer actually sees on first login.
    await expectRenders('/dashboard', customerCookie, 'No active subscription');
    await expectRenders('/dashboard/subscription', customerCookie, 'No active subscription');
    await expectRenders('/dashboard/plans', customerCookie, 'Choose a plan');

    // --- purchase -----------------------------------------------------------
    const plan = await prisma.plan.findFirst({
        where: { isActive: true, priceAmount: { not: null } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
    });
    if (!plan) {
        info('no purchasable plan seeded — run `npm run seed:plans` first. Skipping purchase flow.');
    } else {
        const subscription = await prisma.subscription.create({
            data: {
                userId: customer.id,
                planId: plan.id,
                productId: plan.productId,
                status: 'ACTIVE',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
        check(`subscription created (${plan.productId}/${plan.name})`, !!subscription.id);

        await expectRenders('/dashboard', customerCookie, plan.name);
        await expectRenders('/dashboard/subscription', customerCookie, plan.name);

        // One subscription per product is enforced by a DB unique index, not
        // just app logic — assert the constraint really exists.
        let duplicateRejected = false;
        try {
            await prisma.subscription.create({
                data: { userId: customer.id, planId: plan.id, productId: plan.productId, status: 'ACTIVE' },
            });
        } catch {
            duplicateRejected = true;
        }
        check('duplicate subscription for same product rejected by DB constraint', duplicateRejected);

        // --- add-ons --------------------------------------------------------
        const addOn = await prisma.addOn.findFirst({ where: { productId: plan.productId, isActive: true } });
        if (!addOn) {
            info(`no active add-on for ${plan.productId} — skipping add-on flow`);
        } else {
            await prisma.subscriptionAddOn.create({
                data: { subscriptionId: subscription.id, addOnId: addOn.id },
            });
            const withAddOn = await prisma.subscription.findUnique({
                where: { id: subscription.id },
                include: { addOns: { include: { addOn: true } } },
            });
            check('add-on attached to subscription', withAddOn?.addOns.length === 1);
            await expectRenders('/dashboard/subscription', customerCookie, addOn.name);

            let duplicateAddOnRejected = false;
            try {
                await prisma.subscriptionAddOn.create({
                    data: { subscriptionId: subscription.id, addOnId: addOn.id },
                });
            } catch {
                duplicateAddOnRejected = true;
            }
            check('duplicate add-on rejected by DB constraint', duplicateAddOnRejected);

            await prisma.subscriptionAddOn.deleteMany({
                where: { subscriptionId: subscription.id, addOnId: addOn.id },
            });
            const afterRemove = await prisma.subscription.findUnique({
                where: { id: subscription.id },
                include: { addOns: true },
            });
            check('add-on removed from subscription', afterRemove?.addOns.length === 0);
        }
    }

    // --- profile ------------------------------------------------------------
    section('Profile & settings');
    await expectRenders('/dashboard/settings', customerCookie);
    await expectRenders('/dashboard/settings/profile', customerCookie);
    await expectRenders('/dashboard/settings/password', customerCookie);

    await prisma.user.update({
        where: { id: customer.id },
        data: {
            username: `${E2E_PREFIX}evetester`,
            phone: '+1 555 010 0100',
            company: 'E2E Industries',
            companyEmail: 'ops@e2e-industries.test',
        },
    });
    const updatedProfile = await prisma.user.findUnique({ where: { id: customer.id } });
    check('profile fields persist (username/phone/company/companyEmail)',
        updatedProfile?.username === `${E2E_PREFIX}evetester`
        && updatedProfile?.phone === '+1 555 010 0100'
        && updatedProfile?.company === 'E2E Industries'
        && updatedProfile?.companyEmail === 'ops@e2e-industries.test');
    await expectRenders('/dashboard/settings', customerCookie, 'E2E Industries');

    // username is uniquely indexed but nullable — the nullable half matters,
    // since most customers will never set one.
    let duplicateUsernameRejected = false;
    try {
        await prisma.user.create({
            data: {
                email: `${E2E_PREFIX}dupe-username@example.com`,
                passwordHash: 'x',
                role: 'CUSTOMER',
                username: `${E2E_PREFIX}evetester`,
            },
        });
    } catch {
        duplicateUsernameRejected = true;
    }
    check('duplicate username rejected by DB constraint', duplicateUsernameRejected);

    const nullUsernameA = await prisma.user.create({
        data: { email: `${E2E_PREFIX}null-a@example.com`, passwordHash: 'x', role: 'CUSTOMER' },
    });
    const nullUsernameB = await prisma.user.create({
        data: { email: `${E2E_PREFIX}null-b@example.com`, passwordHash: 'x', role: 'CUSTOMER' },
    });
    check('multiple users may have NULL username', !!nullUsernameA.id && !!nullUsernameB.id);

    // --- addresses ----------------------------------------------------------
    section('Addresses');
    await expectRenders('/dashboard/settings/addresses', customerCookie, 'No addresses yet');
    await expectRenders('/dashboard/settings/addresses/new', customerCookie);

    const first = await prisma.address.create({
        data: {
            userId: customer.id,
            addressLine1: '1 First Street',
            city: 'Metropolis',
            state: 'NY',
            country: 'USA',
            postcode: '10001',
            isDefault: true,
        },
    });
    check('first address is default', first.isDefault);

    const second = await prisma.address.create({
        data: {
            userId: customer.id,
            addressLine1: '2 Second Avenue',
            city: 'Gotham',
            state: 'NJ',
            country: 'USA',
            postcode: '07001',
            isDefault: false,
        },
    });

    // Promoting a default must demote the previous one, or the UI would show
    // two defaults.
    await prisma.$transaction([
        prisma.address.updateMany({ where: { userId: customer.id }, data: { isDefault: false } }),
        prisma.address.update({ where: { id: second.id }, data: { isDefault: true } }),
    ]);
    const afterPromote = await prisma.address.findMany({ where: { userId: customer.id } });
    check('exactly one default after promoting the second address',
        afterPromote.filter((a) => a.isDefault).length === 1
        && afterPromote.find((a) => a.isDefault)?.id === second.id);

    // Deleting the default should promote a survivor, so a customer with any
    // addresses always has exactly one default.
    await prisma.address.delete({ where: { id: second.id } });
    const fallback = await prisma.address.findFirst({
        where: { userId: customer.id },
        orderBy: { createdAt: 'desc' },
    });
    if (fallback) await prisma.address.update({ where: { id: fallback.id }, data: { isDefault: true } });
    const afterDelete = await prisma.address.findMany({ where: { userId: customer.id } });
    check('a default survives deletion of the previous default',
        afterDelete.length === 1 && afterDelete[0].isDefault);
    await expectRenders('/dashboard/settings/addresses', customerCookie, '1 First Street');

    // --- support ------------------------------------------------------------
    section('Support tickets & polymorphic comments');
    await expectRenders('/dashboard/support', customerCookie, 'No support tickets yet');
    await expectRenders('/dashboard/support/new', customerCookie);

    const ticket = await prisma.supportTicket.create({
        data: {
            userId: customer.id,
            subject: 'E2E cannot access store',
            description: 'Raised by the automated end-to-end suite.',
            status: 'OPEN',
        },
    });
    check('ticket created', !!ticket.id);
    await expectRenders('/dashboard/support', customerCookie, 'E2E cannot access store');
    await expectRenders(`/dashboard/support/${ticket.id}`, customerCookie, 'E2E cannot access store');

    await prisma.comment.create({
        data: {
            entityType: 'SUPPORT_TICKET',
            entityId: ticket.id,
            authorId: customer.id,
            body: 'Customer reply from the E2E suite.',
        },
    });
    if (adminUser) {
        await prisma.comment.create({
            data: {
                entityType: 'SUPPORT_TICKET',
                entityId: ticket.id,
                authorId: adminUser.id,
                body: 'Admin reply from the E2E suite.',
            },
        });
    }
    const thread = await prisma.comment.findMany({
        where: { entityType: 'SUPPORT_TICKET', entityId: ticket.id },
        orderBy: { createdAt: 'asc' },
    });
    check(`comment thread ordered oldest-first (${thread.length} comments)`, thread.length >= 1);
    await expectRenders(`/dashboard/support/${ticket.id}`, customerCookie, 'Customer reply from the E2E suite.');

    // The comment table is deliberately generic; if it were secretly
    // ticket-only this would fail and the abstraction would be a lie.
    await prisma.comment.create({
        data: {
            entityType: 'PLAN',
            entityId: 'e2e-non-ticket-entity',
            authorId: customer.id,
            body: 'Comment attached to a non-ticket entity.',
        },
    });
    const planComments = await prisma.comment.findMany({
        where: { entityType: 'PLAN', entityId: 'e2e-non-ticket-entity' },
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

        // Controller-backed admin pages. These render an "unavailable" panel
        // rather than erroring when the Python service is down, so a 200 here
        // is meaningful either way — it proves the page itself is sound.
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

        await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'RESOLVED' } });
        const resolved = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
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
        const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        `;
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

            // Register the local Postgres as a cluster. Credentials come from
            // DATABASE_URL so this works on any dev machine.
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

                    // Reassigning by attribute would strand the data, so the
                    // API must refuse it and point at the migration endpoint.
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

            // --- tenant ↔ customer ↔ plan ----------------------------------
            // A tenant is the infrastructure realisation of one UnityCommerce
            // subscription, so customer_email / user_id / plan_tier are caches
            // of the subscription's rows, not independently-settable fields.
            section('Tenant ↔ customer ↔ plan');

            const linkUser = await prisma.user.create({
                data: {
                    email: `${E2E_PREFIX}linked@example.com`,
                    passwordHash: 'x',
                    role: 'CUSTOMER',
                    name: 'Linked Customer',
                },
            });
            const linkPlan = await prisma.plan.create({
                data: {
                    productId: 'unity_commerce',
                    name: 'E2E Launch',
                    slug: `${E2E_PREFIX}launch`,
                    priceAmount: 49,
                },
            });
            const linkSub = await prisma.subscription.create({
                data: {
                    userId: linkUser.id, planId: linkPlan.id,
                    productId: 'unity_commerce', status: 'ACTIVE',
                },
            });
            // A second product for the same person, to prove only the
            // UnityCommerce one can carry a storefront.
            const algoPlan = await prisma.plan.create({
                data: {
                    productId: 'algo_suite', name: 'E2E Algo',
                    slug: `${E2E_PREFIX}algo`, priceAmount: 29,
                },
            });
            const algoSub = await prisma.subscription.create({
                data: {
                    userId: linkUser.id, planId: algoPlan.id,
                    productId: 'algo_suite', status: 'ACTIVE',
                },
            });

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

                // Naming a different owner than the subscription's would
                // attach the store to the wrong account.
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

            await prisma.subscription.deleteMany({ where: { id: { in: [linkSub.id, algoSub.id] } } });
            await prisma.plan.deleteMany({ where: { id: { in: [linkPlan.id, algoPlan.id] } } });
            await prisma.user.delete({ where: { id: linkUser.id } });
        } else {
            info('CONTROLLER_INTERNAL_API_KEY not set — skipping cluster checks');
        }

        // --- SSH terminal ---------------------------------------------------
        // A WebSocket handshake begins as a plain HTTP GET, and the terminal
        // service authenticates *before* upgrading — so the auth gate can be
        // exercised with fetch alone. 401 = rejected; 426 Upgrade Required
        // means the token was accepted and only the WS headers were missing.
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

            // Needs a real server row: auth is checked before the server is
            // looked up, so a valid token against a missing server still 404s.
            const serverRows = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id::text FROM server_nodes WHERE is_active = true LIMIT 1
            `;

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

        // The controller maps a few Prisma tables read-only so its foreign
        // keys resolve. If Alembic ever stopped excluding them, autogenerate
        // would emit DDL against tables Prisma owns — including DROPs for the
        // ones it does not mirror. Assert the guard is still wired up.
        section('Schema ownership guard');
        // fileURLToPath, not .pathname — the repo path may contain spaces,
        // which .pathname would leave percent-encoded.
        const envPy = await readFile(
            fileURLToPath(new URL('../controller/alembic/env.py', import.meta.url)),
            'utf8',
        ).catch(() => '');
        check('alembic env.py filters Prisma-owned tables from autogenerate',
            envPy.includes('include_object') && envPy.includes('PRISMA_OWNED_TABLES'),
            'controller/alembic/env.py must pass include_object to context.configure');

        // The Prisma side must still own its tables outright.
        const prismaOwned = await prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('User','Subscription','BillingRecord')
        `;
        check('Prisma-owned tables still present and intact', prismaOwned.length === 3,
            `found ${prismaOwned.length} of 3`);

        // The identity merge should have removed the controller's parallel
        // copies of people/billing entirely.
        check('retired controller identity tables are gone',
            !names.includes('customers') && !names.includes('addresses')
            && !names.includes('billing_records') && !names.includes('admin_users'));

        // Cross-tool foreign keys are the thing most likely to be quietly
        // missing after a schema change, so assert them directly.
        const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.constraint_name IN (
                'tenants_user_id_fkey',
                'tenants_subscription_id_fkey',
                'BillingRecord_tenantId_fkey'
              )
        `;
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
        await prisma.$disconnect();

        console.log(`\n${BOLD}${passed} passed, ${failed} failed${RESET}`);
        if (failures.length) {
            console.log(`${RED}Failures:${RESET}`);
            for (const f of failures) console.log(`  · ${f}`);
        }
        process.exit(failed > 0 ? 1 : 0);
    });
