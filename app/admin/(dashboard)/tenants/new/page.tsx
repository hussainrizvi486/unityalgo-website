import { requireAdmin } from '@/lib/admin-session';
import { controller, ControllerError, type ControllerDatabase } from '@/lib/controller-client';
import { listSubscriptionOptions } from '@/lib/tenant-accounts';
import { NewTenantForm } from './new-tenant-form';

export default async function NewTenantPage() {
    await requireAdmin();

    // A missing controller shouldn't block the form — it just means no cluster
    // choice is offered and the tenant lands on the default.
    let clusters: ControllerDatabase[] = [];
    try {
        clusters = ((await controller.databases.list()).results ?? []).filter((db) => db.role === 'cluster');
    } catch (error) {
        if (!(error instanceof ControllerError)) throw error;
    }

    const subscriptions = await listSubscriptionOptions();

    return (
        <div>
            <h1 className="portal-page-title mb-2">New Tenant</h1>
            <p className="portal-text-body text-muted-foreground mb-8 portal-form">
                This reserves the tenant&apos;s slug, database credentials and platform subdomain. It does not deploy
                anything yet — use <strong>Provision</strong> on the tenant page to create the database and launch the
                container.
            </p>
            <NewTenantForm
                clusters={clusters.map((cluster) => ({
                    id: cluster.id,
                    name: cluster.name,
                    isDefault: cluster.is_default,
                }))}
                subscriptions={subscriptions}
            />
        </div>
    );
}
