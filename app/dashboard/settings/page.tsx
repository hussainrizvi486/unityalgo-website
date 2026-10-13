import {
    requireCustomer,
    requireCustomerSession,
} from '@/lib/customer-session';
import { prisma } from '@/lib/db';
import { SettingsClient } from './settings-client';
export const metadata = { title: 'Settings' };
export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; profileUpdated?: string }>;
}) {
    const user = await requireCustomer();
    const current = await requireCustomerSession();
    const query = await searchParams;
    const sessions = await prisma.loginSession.findMany({
        where: {
            userId: user.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        orderBy: { lastSeenAt: 'desc' },
    });
    return (
        <SettingsClient
            defaultTab={
                ['profile', 'sessions', 'security'].includes(query.tab || '')
                    ? query.tab
                    : 'profile'
            }
            updated={query.profileUpdated === '1'}
            profile={{
                firstName: user.firstName || user.name || '',
                lastName: user.lastName || '',
                email: user.email,
                username: user.username || '',
                phone: user.phone || '',
                company: user.company || '',
                companyEmail: user.companyEmail || '',
            }}
            sessions={sessions.map((session) => ({
                id: session.id,
                userAgent: session.userAgent,
                createdAt: session.createdAt.toISOString(),
                lastSeenAt: session.lastSeenAt.toISOString(),
                expiresAt: session.expiresAt.toISOString(),
                current: current.sessionId === session.id,
            }))}
        />
    );
}
