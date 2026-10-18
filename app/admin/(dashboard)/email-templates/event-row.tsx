'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assignEmailEventAction } from '@/app/admin/email-template-actions';

function Save() {
    const { pending } = useFormStatus();
    return <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>;
}

/** One system event: which template it sends and whether it sends at all. */
export function EventRow({
    eventKey,
    label,
    description,
    purpose,
    templateId,
    enabled,
    required,
    templates,
}: {
    eventKey: string;
    label: string;
    description: string;
    purpose: string;
    templateId: string | null;
    enabled: boolean;
    required: boolean;
    templates: { id: string; name: string; isActive: boolean }[];
}) {
    return (
        <form action={assignEmailEventAction} className="grid items-center gap-gap py-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
            <input type="hidden" name="eventKey" value={eventKey} />
            <div className="min-w-0">
                <p className="font-medium">{label}</p>
                <p className="portal-text-caption text-muted-foreground">{description} Sent from the {purpose.toLowerCase()} mailbox.</p>
            </div>
            <Select name="templateId" defaultValue={templateId ?? 'default'}>
                <SelectTrigger aria-label={`Template for ${label}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">Built-in message</SelectItem>
                    {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}{template.isActive ? '' : ' (inactive)'}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <label className="flex items-center gap-2 portal-text-body text-foreground/80">
                <Checkbox name="enabled" defaultChecked={enabled} disabled={required} />
                {required ? 'Always on' : 'Send'}
            </label>
            <Save />
        </form>
    );
}
