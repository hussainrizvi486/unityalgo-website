import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatAddOnPrice } from '@/lib/pricing';
import { AdminPageHeader, AdminPageError } from '@/components/admin/page-header';
import { deleteAddOnAction, toggleAddOnActiveAction } from '@/app/admin/actions';
import { AddOnsList, type AddOnRow } from './addons-list';

interface AddOnsPageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function AdminAddOnsPage({ searchParams }: AddOnsPageProps) {
    const params = await searchParams;

    const [addOns, totalCount] = await Promise.all([
        db
            .select({ row: schema.addOn, product: schema.product })
            .from(schema.addOn)
            .innerJoin(schema.product, eq(schema.product.id, schema.addOn.productId))
            .orderBy(asc(schema.product.sortOrder), asc(schema.addOn.sortOrder))
            .limit(ADMIN_LIST_LIMIT)
            .then((rows) => rows.map(({ row, product }) => ({ ...row, product }))),
        db.$count(schema.addOn),
    ]);

    const rows: AddOnRow[] = addOns.map((addOn) => ({
        id: addOn.id,
        name: addOn.name,
        description: addOn.description,
        product: addOn.productId,
        productLabel: addOn.product.label,
        price: formatAddOnPrice(addOn),
        isActive: addOn.isActive,
    }));

    return (
        <div>
            <AdminPageHeader
                title="Add-ons"
                subtitle={
                    rows.length < totalCount
                        ? `Showing ${rows.length} of ${totalCount}`
                        : `${totalCount} total`
                }
                action={{ label: 'New Add-on', href: '/admin/addons/new' }}
            />
            {params.error && <AdminPageError message={params.error} />}
            <AddOnsList
                rows={rows}
                toggleAction={toggleAddOnActiveAction}
                deleteAction={deleteAddOnAction}
            />
        </div>
    );
}
