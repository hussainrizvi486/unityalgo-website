import { prisma } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatPlanPrice } from '@/lib/pricing';
import { AdminPageHeader, AdminPageError, AdminPageNotice } from '@/components/admin/page-header';
import { deletePlanAction, togglePlanActiveAction, syncPlanWithPaddleAction } from '@/app/admin/actions';
import { PlansList, type PlanRow } from './plans-list';

interface PlansPageProps {
    searchParams: Promise<{ error?: string; synced?: string; syncError?: string }>;
}

export default async function AdminPlansPage({ searchParams }: PlansPageProps) {
    const params = await searchParams;

    const [plans, totalCount] = await Promise.all([
        prisma.plan.findMany({
            orderBy: [{ product: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
            include: { product: true },
            take: ADMIN_LIST_LIMIT,
        }),
        prisma.plan.count(),
    ]);

    const rows: PlanRow[] = plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        product: plan.productId,
        productLabel: plan.product.label,
        price: formatPlanPrice(plan),
        paddlePriceId: plan.paddlePriceId,
        canSync: plan.priceAmount != null,
        seats: plan.userLimit == null ? 'Unlimited' : `Up to ${plan.userLimit}`,
        isActive: plan.isActive,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Plans"
                subtitle={
                    rows.length < totalCount
                        ? `Showing ${rows.length} of ${totalCount}`
                        : `${totalCount} total`
                }
                action={{ label: 'New Plan', href: '/admin/plans/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            {params.syncError && <AdminPageError message={params.syncError} />}
            {params.synced && <AdminPageNotice message={`${params.synced} is up to date in Paddle.`} />}
            <PlansList
                rows={rows}
                toggleAction={togglePlanActiveAction}
                deleteAction={deletePlanAction}
                syncAction={syncPlanWithPaddleAction}
            />
        </div>
    );
}
