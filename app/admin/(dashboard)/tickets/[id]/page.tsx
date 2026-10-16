import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, ShieldCheck, UserRound } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { addAdminTicketCommentAction, updateTicketStatusAction } from '@/app/admin/actions';
import { listComments, CommentEntityType } from '@/lib/comments';
import { TICKET_STATUS_LABEL } from '@/lib/tickets';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ticket = await db.query.supportTicket.findFirst({
        where: eq(schema.supportTicket.id, id),
        with: { user: { columns: { email: true, name: true, firstName: true, lastName: true } } },
    });

    if (!ticket) {
        notFound();
    }

    const comments = await listComments(CommentEntityType.SUPPORT_TICKET, ticket.id);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const customerName = ticket.user.name || [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(' ') || ticket.user.email;

    return (
        <div className="mx-auto portal-detail">
            <Link href="/admin/tickets" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
                <ArrowLeft className="h-4 w-4" />Back to tickets
            </Link>

            <div className="p-5 sm:p-7 portal-surface">
                <div className="flex flex-col gap-gap sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="portal-text-caption font-semibold text-muted-foreground">{customerName} · {ticket.user.email}</p>
                        <h1 className="portal-page-title mt-1">{ticket.subject}</h1>
                        <p className="mt-1 portal-text-caption text-muted-foreground">Opened {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ticket.createdAt)}</p>
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
                <p className="mt-4 whitespace-pre-wrap portal-text-body leading-6 text-foreground/80">{ticket.description}</p>
            </div>

            <section className="mt-6 p-5 sm:p-7 portal-surface">
                <h2 className="mb-5 text-foreground">Conversation</h2>

                {comments.length === 0 ? (
                    <p className="portal-text-body text-muted-foreground">No replies yet.</p>
                ) : (
                    <div className="portal-fields">
                        {comments.map((comment) => {
                            const isAdmin = comment.author.role === 'ADMIN';
                            const displayName = isAdmin
                                ? (comment.author.name || 'Support team')
                                : comment.author.name || [comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') || 'Customer';
                            return (
                                <div key={comment.id} className="flex gap-3">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full portal-text-caption font-bold text-primary-foreground ${isAdmin ? 'bg-primary' : 'bg-primary'}`}>
                                        {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1 rounded-lg bg-muted p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="portal-text-body font-semibold text-foreground">{displayName}{isAdmin ? ' (Admin)' : ''}</p>
                                            <p className="portal-text-caption text-muted-foreground">{dateFormatter.format(comment.createdAt)}</p>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap portal-text-body leading-6 text-foreground/80">{comment.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <form action={addAdminTicketCommentAction} className="mt-6 space-y-3 border-t border-border/60 pt-6">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <Textarea name="body" required className="min-h-28 rounded-lg" placeholder="Write a reply…" />
                    <Button type="submit" className="gap-2">
                        Send reply<Send className="h-4 w-4" />
                    </Button>
                </form>
            </section>
        </div>
    );
}
