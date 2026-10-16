import Link from 'next/link';
import { ArrowLeft, MessageSquareText } from 'lucide-react';
import { requireCustomerSession } from '@/lib/customer-session';
import { NewTicketForm } from './new-ticket-form';

export default async function NewTicketPage() {
  await requireCustomerSession();

  return (
    <div className="mx-auto portal-page">
      <Link href="/dashboard/support" className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80">
        <ArrowLeft className="h-4 w-4" />Back to tickets
      </Link>
      <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">Support</p>
      <h1 className="portal-page-title mt-2">New support ticket</h1>
      <p className="mt-2 portal-text-body text-muted-foreground">We usually reply within one business day.</p>

      <section className="mt-8 p-5 sm:p-7 portal-surface">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary"><MessageSquareText className="h-5 w-5" /></span>
          <div><h2 className=" text-foreground">Create support request</h2></div>
        </div>
        <NewTicketForm />
      </section>
    </div>
  );
}
