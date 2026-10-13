import { CustomerShell } from '@/components/customer/customer-shell';
import { requireCustomer } from '@/lib/customer-session';
import { listNotifications } from '@/lib/customer-notifications';
import { Inter, Inter_Tight } from 'next/font/google';
import './portal.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-portal-ui',
    display: 'swap',
});
const interTight = Inter_Tight({
    subsets: ['latin'],
    variable: '--font-portal-display',
    display: 'swap',
});

export const metadata = {
    title: { default: 'Customer portal', template: '%s | UnityAlgo' },
};

export default async function CustomerPortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireCustomer();

    return (
        <CustomerShell
            themeClassName={`customer-portal ${inter.variable} ${interTight.variable}`}
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
