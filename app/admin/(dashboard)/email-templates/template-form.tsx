'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMAIL_EVENTS, findEmailEvent, sampleVars } from '@/lib/email-events';
import { renderEmail } from '@/lib/email-render';
import { sendTemplateTestAction, type EmailTemplateFormState } from '@/app/admin/email-template-actions';

export interface TemplateFormValues {
    id?: string;
    name: string;
    subject: string;
    bodyHtml: string;
    isActive: boolean;
    /** The event whose placeholders and sample values the editor shows. */
    previewEvent?: string;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button>;
}

const SHORTCODES = [
    { label: 'Button', insert: '[button url="{{site.url}}"]Button text[/button]' },
    { label: 'Highlighted line', insert: '[callout]Highlighted line[/callout]' },
    { label: 'Large code', insert: '[code]{{otp}}[/code]' },
    { label: 'Small print', insert: '[muted]Small print[/muted]' },
];

export function EmailTemplateForm({
    action,
    defaultValues,
    submitLabel,
}: {
    action: (prev: EmailTemplateFormState | undefined, formData: FormData) => Promise<EmailTemplateFormState>;
    defaultValues?: Partial<TemplateFormValues>;
    submitLabel: string;
}) {
    const isNew = !defaultValues?.id;
    const [state, formAction] = useActionState(action, undefined);
    const formRef = React.useRef<HTMLFormElement>(null);
    const [test, setTest] = React.useState<EmailTemplateFormState | undefined>();
    const [testing, startTest] = React.useTransition();
    const runTest = () => {
        if (!formRef.current) return;
        const data = new FormData(formRef.current);
        startTest(async () => setTest(await sendTemplateTestAction(undefined, data)));
    };
    const [previewEvent, setPreviewEvent] = React.useState(defaultValues?.previewEvent ?? 'site_ready');
    const [subject, setSubject] = React.useState(defaultValues?.subject ?? '');
    const [body, setBody] = React.useState(defaultValues?.bodyHtml ?? '');
    const subjectRef = React.useRef<HTMLInputElement>(null);
    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    // Chips insert into whichever of the two was last used.
    const lastField = React.useRef<'subject' | 'body'>('body');

    const event = findEmailEvent(previewEvent) ?? EMAIL_EVENTS[0];
    const preview = React.useMemo(() => {
        try {
            return renderEmail({ subject, bodyHtml: body }, sampleVars(event));
        } catch {
            return null;
        }
    }, [subject, body, event]);

    function insert(text: string) {
        const field = lastField.current === 'subject' ? subjectRef.current : bodyRef.current;
        if (!field) return;
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        const next = field.value.slice(0, start) + text + field.value.slice(end);
        (lastField.current === 'subject' ? setSubject : setBody)(next);
        requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(start + text.length, start + text.length);
        });
    }

    return (
        <form ref={formRef} action={formAction} className="portal-detail space-y-gap-xl">
            {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
            {state?.error ? <Notice tone="error">{state.error}</Notice> : null}

            <section className="portal-stack">
                <div className="grid md:grid-cols-2 gap-gap-lg">
                    <div>
                        <Label htmlFor="name" className="portal-text-body text-foreground/80 mb-1.5">Template name</Label>
                        <Input id="name" name="name" required maxLength={120} defaultValue={defaultValues?.name} placeholder="Welcome: site ready" />
                    </div>
                    {isNew && (
                        <div>
                            <Label htmlFor="assignTo" className="portal-text-body text-foreground/80 mb-1.5">Use it for <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Select name="assignTo" defaultValue="none">
                                <SelectTrigger id="assignTo"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Do not assign yet</SelectItem>
                                    {EMAIL_EVENTS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </section>

            <section className="portal-stack border-t border-border pt-8">
                <div className="grid md:grid-cols-2 gap-gap-lg">
                    <div>
                        <Label htmlFor="previewEvent" className="portal-text-body text-foreground/80 mb-1.5">Write it for this event</Label>
                        <Select name="previewEvent" value={previewEvent} onValueChange={setPreviewEvent}>
                            <SelectTrigger id="previewEvent"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {EMAIL_EVENTS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="mt-1.5 portal-text-caption text-muted-foreground">{event.description} Decides which placeholders are listed and what the preview shows.</p>
                    </div>
                    <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={() => { setSubject(event.defaultSubject); setBody(event.defaultBody); }}>
                            Start from the built-in message
                        </Button>
                    </div>
                </div>

                <div>
                    <Label htmlFor="subject" className="portal-text-body text-foreground/80 mb-1.5">Subject</Label>
                    <Input id="subject" name="subject" required maxLength={300} ref={subjectRef} value={subject} onFocus={() => { lastField.current = 'subject'; }} onChange={(e) => setSubject(e.target.value)} placeholder="{{site.name}} is ready" />
                </div>

                <div>
                    <Label htmlFor="bodyHtml" className="portal-text-body text-foreground/80 mb-1.5">Message (HTML)</Label>
                    <Textarea id="bodyHtml" name="bodyHtml" required rows={14} ref={bodyRef} value={body} onFocus={() => { lastField.current = 'body'; }} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="portal-text-caption text-muted-foreground">Add:</span>
                        {SHORTCODES.map((code) => (
                            <Button key={code.label} type="button" size="sm" variant="outline" onClick={() => { lastField.current = 'body'; insert(code.insert); }}>{code.label}</Button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="portal-text-body font-medium">Placeholders for “{event.label}”</p>
                    <p className="mt-1 portal-text-caption text-muted-foreground">Click one to put it where the cursor is. It is replaced with the real value when the email is sent; a placeholder this event does not have becomes empty.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {event.placeholders.map((placeholder) => (
                            <button
                                key={placeholder.key}
                                type="button"
                                title={`${placeholder.label} · e.g. ${placeholder.sample}`}
                                onClick={() => insert(`{{${placeholder.key}}}`)}
                                className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs hover:bg-secondary"
                            >
                                {`{{${placeholder.key}}}`}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="portal-stack border-t border-border pt-8">
                <h2 className="portal-text-body text-foreground">Preview</h2>
                <div className="rounded-lg border border-border">
                    <div className="border-b border-border px-4 py-2 portal-text-body"><span className="text-muted-foreground">Subject: </span>{preview?.subject || '—'}</div>
                    <iframe title="Email preview" sandbox="" srcDoc={preview ? `<!doctype html><html style="color-scheme:light;background:Canvas"><body style="margin:16px">${preview.html}</body></html>` : ''} className="h-96 w-full" />
                </div>
                <div className="rounded-lg border border-border p-4">
                    <p className="portal-text-body font-medium">Send a test</p>
                    <p className="mt-1 portal-text-caption text-muted-foreground">Sends what is above, filled with sample values, through the mailbox for this event. Nothing is saved.</p>
                    <div className="mt-3 flex flex-wrap items-end gap-gap">
                        <div className="min-w-0 flex-1">
                            <Label htmlFor="testTo" className="portal-text-body text-foreground/80 mb-1.5">Send to</Label>
                            <Input id="testTo" name="testTo" type="email" placeholder="you@example.com" />
                        </div>
                        <Button type="button" variant="outline" onClick={runTest} disabled={testing}>{testing ? 'Sending…' : 'Send test'}</Button>
                    </div>
                    {test?.error ? <Notice tone="error" className="mt-3">{test.error}</Notice> : null}
                    {test?.success ? <Notice tone="success" className="mt-3">{test.success}</Notice> : null}
                </div>
            </section>

            <section className="border-t border-border pt-8">
                <label className="flex items-center gap-2.5 portal-text-body text-foreground/80">
                    <Checkbox name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
                    Active
                    <span className="portal-text-caption text-muted-foreground">An inactive template is skipped and its events send the built-in message.</span>
                </label>
            </section>

            <div className="flex items-center gap-3 border-t border-border pt-6">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline"><Link href="/admin/email-templates">Cancel</Link></Button>
            </div>
        </form>
    );
}
