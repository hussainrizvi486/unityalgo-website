import type { TicketStatus } from '@prisma/client';

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
    OPEN: 'Open',
    IN_PROGRESS: 'In progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
};

export const TICKET_STATUS_BADGE_VARIANT: Record<TicketStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
    OPEN: 'info',
    IN_PROGRESS: 'warning',
    RESOLVED: 'success',
    CLOSED: 'neutral',
};
