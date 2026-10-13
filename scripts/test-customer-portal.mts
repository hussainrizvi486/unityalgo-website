import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SignJWT } from 'jose';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const base = 'http://localhost:3000';
const ids: string[] = [];
async function token(userId: string, email: string, sessionId?: string) {
    return new SignJWT({ userId, email, ...(sessionId ? { sessionId } : {}) })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
}
try {
    const apps = await prisma.appCatalog.findMany();
    for (const slug of ['lending', 'fbr-integration', 'point-of-sale'])
        assert.ok(apps.some((app) => app.slug === slug));
    const users = await Promise.all(
        [0, 1].map(async (index) => {
            const user = await prisma.user.create({
                data: {
                    email: `portal-check-${randomUUID()}@example.test`,
                    passwordHash: 'test-only',
                    role: 'CUSTOMER',
                    firstName: `Test${index}`,
                    lastName: 'Customer',
                },
            });
            ids.push(user.id);
            return user;
        }),
    );
    const sessions = await Promise.all(
        users.map((user) =>
            prisma.loginSession.create({
                data: {
                    userId: user.id,
                    userAgent: 'Portal integration test',
                    expiresAt: new Date(Date.now() + 3600_000),
                },
            }),
        ),
    );
    const cookies = await Promise.all(
        users.map(
            async (user, index) =>
                `unityalgo_customer_session=${await token(user.id, user.email, sessions[index].id)}`,
        ),
    );
    const foreignNotice = await prisma.notification.create({
        data: {
            userId: users[1].id,
            eventKey: 'private',
            title: 'Private notification',
            body: 'Must not leak',
        },
    });
    const ownNotice = await prisma.notification.create({
        data: {
            userId: users[0].id,
            eventKey: 'owned',
            title: 'Own notification',
            body: 'Owned by this customer',
        },
    });
    const notifications = await fetch(`${base}/api/customer/notifications`, {
        headers: { cookie: cookies[0] },
    });
    assert.equal(notifications.status, 200);
    const payload = await notifications.json();
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].id, ownNotice.id);
    const markForeign = await fetch(`${base}/api/customer/notifications`, {
        method: 'POST',
        headers: {
            cookie: cookies[0],
            origin: base,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: foreignNotice.id }),
    });
    assert.equal(markForeign.status, 200);
    assert.equal(
        (
            await prisma.notification.findUniqueOrThrow({
                where: { id: foreignNotice.id },
            })
        ).readAt,
        null,
    );
    const markOwn = await fetch(`${base}/api/customer/notifications`, {
        method: 'POST',
        headers: {
            cookie: cookies[0],
            origin: base,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ownNotice.id }),
    });
    assert.equal(markOwn.status, 200);
    assert.equal((await markOwn.json()).unread, 0);
    const crossOrigin = await fetch(`${base}/api/customer/notifications`, {
        method: 'POST',
        headers: {
            cookie: cookies[0],
            origin: 'https://example.test',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ all: true }),
    });
    assert.equal(crossOrigin.status, 403);
    for (const path of [
        '/dashboard',
        '/dashboard/settings',
        '/dashboard/sites',
        '/dashboard/sites/new',
        '/dashboard/app-store',
        '/dashboard/components',
        '/dashboard/settings/password',
        '/dashboard/settings/profile',
    ]) {
        const response = await fetch(base + path, {
            headers: { cookie: cookies[0] },
        });
        const body = await response.text();
        assert.equal(response.status, 200, path);
        assert.ok(
            !body.includes('NEXT_HTTP_ERROR_FALLBACK;500') &&
                !body.includes('Application error'),
            path,
        );
        console.log('Rendered', path);
    }
    const legacy = await fetch(`${base}/api/customer/notifications`, {
        headers: {
            cookie: `unityalgo_customer_session=${await token(users[0].id, users[0].email)}`,
        },
    });
    assert.equal(legacy.status, 401);
    await prisma.loginSession.update({
        where: { id: sessions[0].id },
        data: { revokedAt: new Date() },
    });
    const revoked = await fetch(`${base}/api/customer/notifications`, {
        headers: { cookie: cookies[0] },
    });
    assert.equal(revoked.status, 401);
    const expired = await prisma.loginSession.create({
        data: {
            userId: users[0].id,
            userAgent: 'Expired test',
            expiresAt: new Date(Date.now() - 1000),
        },
    });
    const expiredResponse = await fetch(`${base}/api/customer/notifications`, {
        headers: {
            cookie: `unityalgo_customer_session=${await token(users[0].id, users[0].email, expired.id)}`,
        },
    });
    assert.equal(expiredResponse.status, 401);
    console.log(
        'Portal checks passed: catalogue, page rendering, notification ownership and read status, CSRF, revoked/expired/legacy sessions.',
    );
} finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
}
