import { prisma } from '@/lib/db';
import { ADMIN_LIST_LIMIT } from '@/lib/pagination';
import { formatDate } from '@/lib/admin-format';
import { AdminPageHeader } from '@/components/admin/page-header';
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABEL } from '@/lib/tickets';
import { TicketsList, type TicketRow } from './tickets-list';

export default async function AdminTicketsPage() {
    const [tickets, totalCount] = await Promise.all([
        prisma.supportTicket.findMany({
            include: { user: { select: { email: true, name: true, firstName: true, lastName: true } } },
            orderBy: { updatedAt: 'desc' },
            take: ADMIN_LIST_LIMIT,
        }),
        prisma.supportTicket.count(),
    ]);

    const rows: TicketRow[] = tickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        customerName:
            ticket.user.name
            || [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(' ')
            || ticket.user.email,
        customerEmail: ticket.user.email,
        status: ticket.status,
        statusLabel: TICKET_STATUS_LABEL[ticket.status],
        statusVariant: TICKET_STATUS_BADGE_VARIANT[ticket.status],
        updated: formatDate(ticket.updatedAt),
    }));

    return (
        <div>
            <AdminPageHeader
                title="Support tickets"
                subtitle={
                    rows.length < totalCount
                        ? `Showing the ${rows.length} most recent of ${totalCount}`
                        : `${totalCount} total`
                }
            />
            <TicketsList rows={rows} />
        </div>
    );
}
