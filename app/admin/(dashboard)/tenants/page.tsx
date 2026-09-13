import { controller, ControllerError, type ControllerTenant } from '@/lib/controller-client';
import { requireAdmin } from '@/lib/admin-session';
import { ControllerOffline } from '@/components/admin/controller-offline';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { formatDate, humanizeEnum } from '@/lib/admin-format';
import { TenantsList, type TenantRow } from './tenants-list';

interface PageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function AdminTenantsPage({ searchParams }: PageProps) {
    await requireAdmin();
    const params = await searchParams;

    let tenants: ControllerTenant[];
    try {
        tenants = (await controller.tenants.list()).results ?? [];
    } catch (error) {
        if (error instanceof ControllerError) return <ControllerOffline message={error.message} />;
        throw error;
    }

    const rows: TenantRow[] = tenants.map((tenant) => ({
        id: tenant.id,
        slug: tenant.tenant_slug,
        created: formatDate(tenant.created_at),
        domain: tenant.custom_domain ?? tenant.assigned_subdomain ?? '—',
        customerId: tenant.customer?.id ?? null,
        // Falls back to the bare email for a tenant with no linked account.
        customerName: tenant.customer?.name ?? tenant.customer_email,
        customerEmail: tenant.customer ? tenant.customer.email : '',
        planName: tenant.subscription?.plan?.name ?? tenant.plan_tier,
        planDetail: tenant.subscription ? humanizeEnum(tenant.subscription.status) : null,
        resources: `${tenant.memory_limit_mb} MB · ${tenant.cpu_limit_cores} CPU`,
        status: tenant.status,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Tenants"
                subtitle={`${rows.length} storefront${rows.length === 1 ? '' : 's'}`}
                action={{ label: 'New Tenant', href: '/admin/tenants/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            <TenantsList rows={rows} />
        </div>
    );
}
