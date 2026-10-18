'use client';

import { Notice } from '@/components/ui/notice';
import { useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { testSmtpSettingsAction, type EmailAccountFormState } from '@/app/admin/email-actions';

export interface EmailAccountFormValues {
    id?: string;
    label: string;
    address: string;
    fromName: string;
    purpose: string;
    smtpHost: string;
    smtpPort: string;
    smtpSecure: boolean;
    smtpUsername: string;
    imapHost: string;
    imapPort: string;
    imapSecure: boolean;
    imapUsername: string;
    isDefault: boolean;
    isActive: boolean;
}

const PURPOSES = [
    { value: 'TRANSACTIONAL', label: 'Transactional', hint: 'Verification codes, password resets' },
    { value: 'SUPPORT', label: 'Support', hint: 'Ticket correspondence' },
    { value: 'BILLING', label: 'Billing', hint: 'Invoices and payment notices' },
    { value: 'MARKETING', label: 'Marketing', hint: 'Announcements and campaigns' },
];

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="">
            {pending ? 'Saving...' : label}
        </Button>
    );
}

export function EmailAccountForm({
    action,
    defaultValues,
    submitLabel,
    isEdit = false,
}: {
    action: (prev: EmailAccountFormState | undefined, formData: FormData) => Promise<EmailAccountFormState>;
    defaultValues?: Partial<EmailAccountFormValues>;
    submitLabel: string;
    /** On edit, blank password fields mean "keep the stored one". */
    isEdit?: boolean;
}) {
    const [state, formAction] = useActionState(action, undefined);
    const formRef = useRef<HTMLFormElement>(null);
    const [test, setTest] = useState<EmailAccountFormState | undefined>();
    const [testing, startTest] = useTransition();
    const runTest = () => {
        if (!formRef.current) return;
        const data = new FormData(formRef.current);
        startTest(async () => setTest(await testSmtpSettingsAction(undefined, data)));
    };
    const [showIncoming, setShowIncoming] = useState(Boolean(defaultValues?.imapHost));

    return (
        <form ref={formRef} action={formAction} className="portal-detail space-y-gap-xl">
            {defaultValues?.id ? <input type="hidden" name="id" value={defaultValues.id} /> : null}

            {state?.error ? (
                <Notice tone="error">{state.error}</Notice>
            ) : null}

            <section className="portal-stack">
                <h2 className="portal-text-body text-foreground">Identity</h2>
                <div className="grid md:grid-cols-2 gap-gap-lg">
                    <div>
                        <Label htmlFor="label" className="portal-text-body text-foreground/80 mb-1.5">Label</Label>
                        <Input id="label" name="label" required defaultValue={defaultValues?.label} placeholder="Support" />
                    </div>
                    <div>
                        <Label htmlFor="address" className="portal-text-body text-foreground/80 mb-1.5">Email address</Label>
                        <Input id="address" name="address" type="email" required defaultValue={defaultValues?.address} placeholder="support@unityalgo.com" />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-gap-lg">
                    <div>
                        <Label htmlFor="fromName" className="portal-text-body text-foreground/80 mb-1.5">
                            From name <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input id="fromName" name="fromName" defaultValue={defaultValues?.fromName} placeholder="UnityAlgo Support" />
                    </div>
                    <div>
                        <Label htmlFor="purpose" className="portal-text-body text-foreground/80 mb-1.5">Purpose</Label>
                        <Select name="purpose" defaultValue={defaultValues?.purpose ?? 'TRANSACTIONAL'}>
                            <SelectTrigger id="purpose"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PURPOSES.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>{p.label} — {p.hint}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <section className="portal-stack border-t border-border pt-8">
                <div>
                    <h2 className="portal-text-body text-foreground">Outgoing mail (SMTP)</h2>
                    <p className="mt-1 portal-text-caption text-muted-foreground">Required. This is what sends mail.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-gap-lg">
                    <div className="md:col-span-2">
                        <Label htmlFor="smtpHost" className="portal-text-body text-foreground/80 mb-1.5">Host</Label>
                        <Input id="smtpHost" name="smtpHost" required defaultValue={defaultValues?.smtpHost} placeholder="smtp.gmail.com" />
                    </div>
                    <div>
                        <Label htmlFor="smtpPort" className="portal-text-body text-foreground/80 mb-1.5">Port</Label>
                        <SmartInput id="smtpPort" name="smtpPort" kind="integer" min={1} max={65535} required defaultValue={defaultValues?.smtpPort ?? '587'} />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-gap-lg">
                    <div>
                        <Label htmlFor="smtpUsername" className="portal-text-body text-foreground/80 mb-1.5">Username</Label>
                        <Input id="smtpUsername" name="smtpUsername" required defaultValue={defaultValues?.smtpUsername} autoComplete="off" />
                    </div>
                    <div>
                        <Label htmlFor="smtpPassword" className="portal-text-body text-foreground/80 mb-1.5">
                            Password {isEdit ? <span className="text-muted-foreground font-normal">(blank = unchanged)</span> : null}
                        </Label>
                        <Input id="smtpPassword" name="smtpPassword" type="password" required={!isEdit} autoComplete="new-password" placeholder={isEdit ? '••••••••' : ''} />
                    </div>
                </div>
                <label className="flex items-start gap-2.5 portal-text-body text-foreground/80">
                    <Checkbox name="smtpSecure" defaultChecked={defaultValues?.smtpSecure} className="mt-0.5" />
                    <span>
                        Implicit TLS
                        <span className="block portal-text-caption text-muted-foreground">
                            On for port 465. Leave off for 587 and 25, which start plaintext and upgrade via STARTTLS.
                        </span>
                    </span>
                </label>
                <div className="rounded-lg border border-border p-4">
                    <p className="portal-text-body font-medium">Test these settings</p>
                    <p className="mt-1 portal-text-caption text-muted-foreground">
                        Signs in with what is typed above, without saving. Add an address to also send a test message.
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-gap">
                        <div className="min-w-0 flex-1">
                            <Label htmlFor="testTo" className="portal-text-body text-foreground/80 mb-1.5">Send a test message to <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input id="testTo" name="testTo" type="email" placeholder="you@example.com" />
                        </div>
                        <Button type="button" variant="outline" onClick={runTest} disabled={testing}>
                            {testing ? 'Testing…' : 'Test connection'}
                        </Button>
                    </div>
                    {test?.error ? <Notice tone="error" className="mt-3">{test.error}</Notice> : null}
                    {test?.success ? <Notice tone="success" className="mt-3">{test.success}</Notice> : null}
                </div>
            </section>

            <section className="portal-stack border-t border-border pt-8">
                <div className="flex items-start justify-between gap-gap">
                    <div>
                        <h2 className="portal-text-body text-foreground">Incoming mail (IMAP)</h2>
                        <p className="mt-1 portal-text-caption text-muted-foreground">
                            Optional, and a separate protocol — SMTP can only send. Leave this off for a send-only mailbox.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowIncoming((v) => !v)}
                    >
                        {showIncoming ? 'Remove' : 'Configure'}
                    </Button>
                </div>

                {showIncoming ? (
                    <>
                        <div className="grid md:grid-cols-3 gap-gap-lg">
                            <div className="md:col-span-2">
                                <Label htmlFor="imapHost" className="portal-text-body text-foreground/80 mb-1.5">Host</Label>
                                <Input id="imapHost" name="imapHost" defaultValue={defaultValues?.imapHost} placeholder="imap.gmail.com" />
                            </div>
                            <div>
                                <Label htmlFor="imapPort" className="portal-text-body text-foreground/80 mb-1.5">Port</Label>
                                <SmartInput id="imapPort" name="imapPort" kind="integer" min={1} max={65535} defaultValue={defaultValues?.imapPort ?? '993'} />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-gap-lg">
                            <div>
                                <Label htmlFor="imapUsername" className="portal-text-body text-foreground/80 mb-1.5">Username</Label>
                                <Input id="imapUsername" name="imapUsername" defaultValue={defaultValues?.imapUsername} autoComplete="off" />
                            </div>
                            <div>
                                <Label htmlFor="imapPassword" className="portal-text-body text-foreground/80 mb-1.5">
                                    Password {isEdit ? <span className="text-muted-foreground font-normal">(blank = unchanged)</span> : null}
                                </Label>
                                <Input id="imapPassword" name="imapPassword" type="password" autoComplete="new-password" placeholder={isEdit ? '••••••••' : ''} />
                            </div>
                        </div>
                        <label className="flex items-center gap-2.5 portal-text-body text-foreground/80">
                            <Checkbox name="imapSecure" defaultChecked={defaultValues?.imapSecure ?? true} />
                            Implicit TLS (port 993)
                        </label>
                    </>
                ) : null}
            </section>

            <section className="space-y-gap border-t border-border pt-8">
                <label className="flex items-start gap-2.5 portal-text-body text-foreground/80">
                    <Checkbox name="isDefault" defaultChecked={defaultValues?.isDefault} className="mt-0.5" />
                    <span>
                        Use as the default account
                        <span className="block portal-text-caption text-muted-foreground">
                            Any purpose without its own mailbox sends from here. Only one account can be the default.
                        </span>
                    </span>
                </label>
                <label className="flex items-center gap-2.5 portal-text-body text-foreground/80">
                    <Checkbox name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
                    Active
                </label>
            </section>

            <div className="flex items-center gap-3 border-t border-border pt-6">
                <SubmitButton label={submitLabel} />
                <Button asChild type="button" variant="outline"><Link href="/admin/email-accounts">Cancel</Link></Button>
            </div>
        </form>
    );
}
