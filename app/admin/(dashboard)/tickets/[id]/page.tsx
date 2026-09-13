import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, ShieldCheck, UserRound } from 'lucide-react';
import { prisma } from '@/lib/db';
import { addAdminTicketCommentAction, updateTicketStatusAction } from '@/app/admin/actions';
import { listComments, CommentEntityType } from '@/lib/comments';
import { TICKET_STATUS_LABEL } from '@/lib/tickets';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        include: { user: { select: { email: true, name: true, firstName: true, lastName: true } } },
    });

    if (!ticket) {
        notFound();
    }

    const comments = await listComments(CommentEntityType.SUPPORT_TICKET, ticket.id);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const customerName = ticket.user.name || [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(' ') || ticket.user.email;

    return (
        <div className="mx-auto max-w-3xl">
            <Link href="/admin/tickets" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
                <ArrowLeft className="h-4 w-4" />Back to tickets
            </Link>

            <div className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink-400">{customerName} · {ticket.user.email}</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-950">{ticket.subject}</h1>
                        <p className="mt-1 text-xs text-ink-400">Opened {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ticket.createdAt)}</p>
                    </div>
                    <form action={updateTicketStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={ticket.id} />
                        <Select name="status" defaultValue={ticket.status}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" variant="outline" >
                            Update
                        </Button>
                    </form>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">{ticket.description}</p>
            </div>

            <section className="mt-6 rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
                <h2 className="mb-5 font-bold text-ink-900">Conversation</h2>

                {comments.length === 0 ? (
                    <p className="text-sm text-ink-400">No replies yet.</p>
                ) : (
                    <div className="space-y-5">
                        {comments.map((comment) => {
                            const isAdmin = comment.author.role === 'ADMIN';
                            const displayName = isAdmin
                                ? (comment.author.name || 'Support team')
                                : comment.author.name || [comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') || 'Customer';
                            return (
                                <div key={comment.id} className="flex gap-3">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isAdmin ? 'bg-brand' : 'bg-ink-900'}`}>
                                        {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1 rounded-lg bg-ink-50 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-ink-900">{displayName}{isAdmin ? ' (Admin)' : ''}</p>
                                            <p className="text-xs text-ink-400">{dateFormatter.format(comment.createdAt)}</p>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">{comment.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <form action={addAdminTicketCommentAction} className="mt-6 space-y-3 border-t border-ink-100 pt-6">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <Textarea name="body" required className="min-h-28 rounded-lg" placeholder="Write a reply…" />
                    <Button type="submit" className="gap-2 bg-ink-900 text-white hover:bg-ink-800">
                        Send reply<Send className="h-4 w-4" />
                    </Button>
                </form>
            </section>
        </div>
    );
}
