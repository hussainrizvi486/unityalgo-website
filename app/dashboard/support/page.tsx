import Link from 'next/link';
import { CalendarClock, MessageCircle, MessageSquareText, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABEL } from '@/lib/tickets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function SupportPage() {
  const session = await requireCustomerSession();

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: 'desc' },
  });

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Support</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Support tickets</h1>
          <p className="mt-2 text-sm text-ink-500">Raise a request and track its progress here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {whatsappNumber ? (
            <Link href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-success-600 text-success-700 hover:bg-success-50">
                <MessageCircle className="h-4 w-4" />Chat on WhatsApp
              </Button>
            </Link>
          ) : null}
          <Link href="/dashboard/support/new">
            <Button className="gap-2 bg-ink-900 text-white hover:bg-ink-800 py-2">
              <Plus className="size-4" />New ticket
            </Button>
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white p-6 text-center">
          <MessageSquareText className="size-8 text-ink-300" />
          <h2 className="mt-4 text-lg font-bold text-ink-900">No support tickets yet</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-500">Raise a ticket and our team will get back to you.</p>
        </section>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-ink-200 bg-white">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
              className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4 last:border-0 hover:bg-ink-50/60 sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{ticket.subject}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
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
