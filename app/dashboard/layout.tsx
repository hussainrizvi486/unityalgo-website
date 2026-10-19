import { CustomerShell } from '@/components/customer/customer-shell';
import { requireCustomer } from '@/lib/customer-session';
import { listNotifications } from '@/lib/customer-notifications';
import { cookies } from 'next/headers';
import { DASHBOARD_THEME_COOKIE } from '@/lib/dashboard-theme';
import './portal.css';

export const metadata = {
    title: { default: 'Customer portal', template: '%s | UnityAlgo' },
};

export default async function CustomerPortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireCustomer();
    const dark = (await cookies()).get(DASHBOARD_THEME_COOKIE)?.value === 'dark';

    return (
        <CustomerShell
            initialDark={dark}
            tourPending={!user.tourCompletedAt}
            notifications={await listNotifications(user.id)}
            user={{
                firstName: user.firstName || user.name || 'Customer',
                lastName: user.lastName || '',
                email: user.email,
            }}
        >
            {children}
        </CustomerShell>
    );
}
