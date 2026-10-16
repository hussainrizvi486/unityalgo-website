import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/admin-format';
import { AdminPageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { LEAD_SOURCE_LABEL, LEAD_STATUS_BADGE_VARIANT, LEAD_STATUS_LABEL } from '@/lib/leads';
import { LeadForm } from './lead-form';

export default async function AdminLeadPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const lead = await db.query.lead.findFirst({
        where: eq(schema.lead.id, id),
        with: { user: { columns: { id: true, email: true, name: true } } },
    });
    if (!lead) notFound();

    return (
        <div>
            <AdminPageHeader
                title={`${lead.firstName} ${lead.lastName}`.trim() || lead.email}
                subtitle={`${LEAD_SOURCE_LABEL[lead.source]} · ${formatDate(lead.createdAt)}`}
            />

            <div className="grid max-w-wide gap-gap-lg lg:grid-cols-[1.3fr_1fr]">
                <section className="portal-fields portal-panel-padding portal-surface">
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={LEAD_STATUS_BADGE_VARIANT[lead.status]}>
                            {LEAD_STATUS_LABEL[lead.status]}
                        </Badge>
                        {lead.user && (
                            <Link
                                href={`/admin/users/${lead.user.id}`}
                                className="portal-text-caption font-semibold text-primary hover:underline"
                            >
                                Has an account — view user
                            </Link>
                        )}
                    </div>

                    <dl className="grid gap-gap sm:grid-cols-2">
                        {[
                            ['Email', <a key="e" href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>],
                            ['Phone', <a key="p" href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>],
                            ['Company', lead.company ?? '—'],
                            ['Received', formatDate(lead.createdAt)],
                        ].map(([term, value]) => (
                            <div key={String(term)}>
                                <dt className="portal-text-caption font-semibold uppercase tracking-wide text-muted-foreground">{term}</dt>
                                <dd className="mt-1 portal-text-body text-foreground">{value}</dd>
                            </div>
                        ))}
                    </dl>

                    <div>
                        <h2 className="portal-text-caption uppercase tracking-wide text-muted-foreground">Message</h2>
                        <p className="mt-2 whitespace-pre-wrap portal-text-body leading-relaxed text-foreground/80">{lead.message}</p>
                    </div>
                </section>

                <section className="portal-panel-padding portal-surface">
                    <h2 className="mb-5 portal-text-body text-foreground">Follow-up</h2>
                    <LeadForm id={lead.id} status={lead.status} notes={lead.notes ?? ''} />
                </section>
            </div>
        </div>
    );
}
