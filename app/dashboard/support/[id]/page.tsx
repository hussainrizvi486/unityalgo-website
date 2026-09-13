import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, UserRound } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireCustomerSession } from '@/lib/customer-session';
import { addTicketCommentAction } from '@/app/customer/actions';
import { listComments, CommentEntityType } from '@/lib/comments';
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABEL } from '@/lib/tickets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomerSession();

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || ticket.userId !== session.userId) {
    notFound();
  }

  const comments = await listComments(CommentEntityType.SUPPORT_TICKET, ticket.id);
  const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/support" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to tickets
      </Link>

      <section className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-400">Ticket · {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ticket.createdAt)}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-950">{ticket.subject}</h1>
          </div>
          <Badge variant={TICKET_STATUS_BADGE_VARIANT[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">{ticket.description}</p>
      </section>

      <section className="mt-6 rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
        <h2 className="mb-5 font-bold text-ink-900">Conversation</h2>

        {comments.length === 0 ? (
          <p className="text-sm text-ink-400">No replies yet.</p>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => {
              const isAdmin = comment.author.role === 'ADMIN';
              const displayName = isAdmin
                ? 'Support team'
                : comment.author.name || [comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') || 'You';
              return (
                <div key={comment.id} className="flex gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isAdmin ? 'bg-brand' : 'bg-ink-900'}`}>
                    {isAdmin ? 'ST' : <UserRound className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg bg-ink-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink-900">{displayName}</p>
                      <p className="text-xs text-ink-400">{dateFormatter.format(comment.createdAt)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">{comment.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ticket.status !== 'CLOSED' ? (
          <form action={addTicketCommentAction} className="mt-6 space-y-3 border-t border-ink-100 pt-6">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <Textarea name="body" required className="min-h-28 rounded-lg" placeholder="Write a reply…" />
            <Button type="submit" className="gap-2 bg-ink-900 text-white hover:bg-ink-800">
              Send reply<Send className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <p className="mt-6 border-t border-ink-100 pt-6 text-sm text-ink-400">This ticket is closed. Raise a new ticket if you need further help.</p>
        )}
      </section>
    </div>
  );
}
