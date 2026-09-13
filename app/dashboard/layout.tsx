import { CustomerShell } from '@/components/customer/customer-shell';
import { requireCustomer } from '@/lib/customer-session';

export default async function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
    const user = await requireCustomer();

    return (
        <CustomerShell
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
