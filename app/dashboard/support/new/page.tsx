import Link from 'next/link';
import { ArrowLeft, MessageSquareText } from 'lucide-react';
import { requireCustomerSession } from '@/lib/customer-session';
import { NewTicketForm } from './new-ticket-form';

export default async function NewTicketPage() {
  await requireCustomerSession();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/support" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" />Back to tickets
      </Link>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Support</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">New support ticket</h1>
      <p className="mt-2 text-sm text-ink-500">We usually reply within one business day.</p>

      <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-brand"><MessageSquareText className="h-5 w-5" /></span>
          <div><h2 className="font-bold text-ink-900">Create support request</h2></div>
        </div>
        <NewTicketForm />
      </section>
    </div>
  );
}
