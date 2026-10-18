import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { Mail, Pencil } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-session';
import { EMAIL_EVENTS } from '@/lib/email-events';
import { formatDate } from '@/lib/admin-format';
import { deleteEmailTemplateAction } from '@/app/admin/email-template-actions';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DeleteButton } from '@/components/admin/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventRow } from './event-row';

export const metadata = { title: 'Email templates' };

export default async function AdminEmailTemplatesPage() {
    await requireAdmin();
    const [templates, setups] = await Promise.all([
        db.select().from(schema.emailTemplate).orderBy(asc(schema.emailTemplate.name)),
        db.select().from(schema.emailEvent),
    ]);
    const setup = new Map(setups.map((row) => [row.eventKey, row]));
    const usedBy = new Map<string, string[]>();
    for (const row of setups) {
        if (!row.templateId) continue;
        const label = EMAIL_EVENTS.find((event) => event.key === row.eventKey)?.label;
        if (label) usedBy.set(row.templateId, [...(usedBy.get(row.templateId) ?? []), label]);
    }

    return (
        <div>
            <AdminPageHeader title="Email templates" subtitle="Choose what each system email says. Placeholders such as {{site.name}} are filled in with the real details when it is sent." action={{ label: 'New template', href: '/admin/email-templates/new' }} />

            <section className="rounded-xl border border-border p-card">
                <h2>System emails</h2>
                <p className="mt-1 portal-text-caption text-muted-foreground">
                    Each event sends the template assigned here. “Built-in message” is the wording the platform ships with. Which mailbox sends each email is set under Email accounts.
                </p>
                <div className="mt-2 divide-y divide-border/60">
                    {EMAIL_EVENTS.map((event) => {
                        const row = setup.get(event.key);
                        return (
                            <EventRow
                                key={event.key}
                                eventKey={event.key}
                                label={event.label}
                                description={event.description}
                                purpose={event.purpose}
                                templateId={row?.templateId ?? null}
                                enabled={event.required || (row ? row.enabled : event.defaultEnabled)}
                                required={Boolean(event.required)}
                                templates={templates.map((template) => ({ id: template.id, name: template.name, isActive: template.isActive }))}
                            />
                        );
                    })}
                </div>
            </section>

            <section className="mt-6 rounded-xl border border-border p-card">
                <h2>Templates ({templates.length})</h2>
                {templates.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
                        <Mail className="h-10 w-10 text-muted-foreground/50" />
                        <p className="font-medium">No templates yet</p>
                        <p className="portal-text-body text-muted-foreground">Every email uses its built-in message until you write a template and assign it above.</p>
                        <Button asChild className="mt-2"><Link href="/admin/email-templates/new">New template</Link></Button>
                    </div>
                ) : (
                    <ul className="mt-2 divide-y divide-border/60">
                        {templates.map((template) => (
                            <li key={template.id} className="flex flex-wrap items-center justify-between gap-gap py-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link href={`/admin/email-templates/${template.id}/edit`} className="font-medium hover:text-primary hover:underline">{template.name}</Link>
                                        {!template.isActive && <Badge variant="neutral">Inactive</Badge>}
                                    </div>
                                    <p className="portal-text-caption text-muted-foreground">
                                        {template.subject} · updated {formatDate(template.updatedAt)}
                                    </p>
                                    <p className="portal-text-caption text-muted-foreground">
                                        {usedBy.get(template.id)?.length ? `Used for: ${usedBy.get(template.id)!.join(', ')}` : 'Not assigned to any event'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button asChild size="sm" variant="outline"><Link href={`/admin/email-templates/${template.id}/edit`}><Pencil className="size-4" />Edit</Link></Button>
                                    <DeleteButton
                                        action={deleteEmailTemplateAction}
                                        id={template.id}
                                        title={`Delete “${template.name}”?`}
                                        description="Events that use it go back to their built-in message. This cannot be undone."
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
