'use client';

import { Notice } from '@/components/ui/notice';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSupportTicketAction, type AccountFormState } from '@/app/customer/actions';


function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending ? 'Sending…' : 'Send request'}<Send className="size-3" />
    </Button>
  );
}

export function NewTicketForm() {
  const [state, formAction] = useActionState<AccountFormState | undefined, FormData>(createSupportTicketAction, undefined);

  return (
    <form action={formAction} className="portal-fields">
      <div>
        <Label htmlFor="subject" className="mb-1.5 portal-text-body text-ink-700">Subject</Label>
        <Input id="subject" name="subject" required placeholder="What do you need help with?" />
      </div>
      <div>
        <Label htmlFor="description" className="mb-1.5 portal-text-body text-ink-700">Message</Label>
        <Textarea id="description" name="description" required className="min-h-40 rounded-lg" placeholder="Tell us what happened and how we can help." />
      </div>
      {state?.error ? <Notice tone="error">{state.error}</Notice> : null}
      <SubmitButton />
    </form>
  );
}
