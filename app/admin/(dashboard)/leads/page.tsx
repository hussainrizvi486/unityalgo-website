import { desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDate } from '@/lib/admin-format';
import { AdminPageHeader } from '@/components/admin/page-header';
import { LEAD_SOURCE_LABEL, LEAD_STATUS_BADGE_VARIANT, LEAD_STATUS_LABEL } from '@/lib/leads';
import { SpreadsheetActions } from '@/components/admin/spreadsheet-actions';
import { LeadsList, type LeadRow } from './leads-list';

export default async function AdminLeadsPage() {
    const [leads, totalCount] = await Promise.all([
        db.query.lead.findMany({
            orderBy: desc(schema.lead.createdAt),
            limit: ADMIN_LIST_LIMIT,
        }),
        db.$count(schema.lead),
    ]);

    const rows: LeadRow[] = leads.map((lead) => ({
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.email,
        phone: lead.phone,
        message: lead.message,
        status: lead.status,
        statusLabel: LEAD_STATUS_LABEL[lead.status],
        statusVariant: LEAD_STATUS_BADGE_VARIANT[lead.status],
        sourceLabel: LEAD_SOURCE_LABEL[lead.source],
        userId: lead.userId,
        created: formatDate(lead.createdAt),
    }));

    return (
        <div>
            <AdminPageHeader
                title="Leads"
                subtitle={
                    rows.length < totalCount
                        ? `Showing the ${rows.length} most recent of ${totalCount}`
                        : `${totalCount} total`
                }
            >
                <SpreadsheetActions entity="leads" />
            </AdminPageHeader>
            <LeadsList rows={rows} />
        </div>
    );
}
