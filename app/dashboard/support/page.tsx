import Link from 'next/link';
import { CalendarClock, MessageCircle, MessageSquareText, Plus } from 'lucide-react';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABEL } from '@/lib/tickets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function SupportPage() {
  const session = await requireCustomerSession();

  const tickets = await db.query.supportTicket.findMany({
    where: eq(schema.supportTicket.userId, session.userId),
    orderBy: desc(schema.supportTicket.updatedAt),
  });

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <div className="mx-auto portal-page">
      <div className="flex flex-col gap-gap sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Support</p>
          <h1 className="portal-page-title mt-2">Support tickets</h1>
          <p className="mt-2 portal-text-body text-muted-foreground">Raise a request and track its progress here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {whatsappNumber ? (
            <Button asChild variant="outline" className="gap-2 border-success text-success hover:bg-success/10"><Link href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />Chat on WhatsApp
              </Link></Button>
          ) : null}
          <Button asChild className="gap-2"><Link href="/dashboard/support/new">
              <Plus className="size-4" />New ticket
            </Link></Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-card text-center">
          <MessageSquareText className="size-8 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg text-foreground">No support tickets yet</h2>
          <p className="mt-2 max-w-sm portal-text-body text-muted-foreground">Raise a ticket and our team will get back to you.</p>
        </section>
      ) : (
        <div className="mt-8 overflow-hidden portal-surface">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
              className="flex items-center justify-between gap-gap border-b border-border/60 px-5 py-4 last:border-0 hover:bg-muted/60 sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate portal-text-body font-semibold text-foreground">{ticket.subject}</p>
                <p className="mt-1 flex items-center gap-1.5 portal-text-caption text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Updated {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ticket.updatedAt)}
                </p>
              </div>
              <Badge variant={TICKET_STATUS_BADGE_VARIANT[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
