'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, Mail, ReceiptText, Store, UserRound } from 'lucide-react';
import { CustomerProfile, CustomerSubscription, readCustomerSession } from '@/lib/customer-mock';

export default function CustomerOverviewPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null);

  useEffect(() => {
    const session = readCustomerSession();
    if (session) {
      setProfile(session.user);
      setSubscription(session.subscription ?? null);
    }
  }, []);

  return <div className="mx-auto max-w-7xl">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Overview</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Welcome back, {profile?.firstName || 'Customer'}.</h1><p className="mt-2 text-sm text-ink-500">Your account and Unity Commerce subscription at a glance.</p></div>

    <div className="grid gap-6 xl:grid-cols-[.78fr_1.22fr]">
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="font-bold text-ink-900">Customer profile</h2><UserRound className="h-5 w-5 text-ink-300" /></div>
        <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">{profile?.avatar ? <Image src={profile.avatar} alt={`${profile.firstName} ${profile.lastName}`} width={72} height={72} unoptimized className="h-18 w-18 rounded-2xl object-cover" /> : <span className="flex h-18 w-18 items-center justify-center rounded-2xl bg-ink-950 text-xl font-bold text-white">{profile?.firstName.charAt(0)}{profile?.lastName.charAt(0)}</span>}<div className="min-w-0"><p className="truncate text-xl font-bold text-ink-950">{profile?.firstName || 'Customer'} {profile?.lastName}</p><p className="mt-1 flex items-center gap-2 break-all text-sm text-ink-500"><Mail className="h-4 w-4 shrink-0" />{profile?.email || 'customer@example.com'}</p><span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700"><CheckCircle2 className="h-3.5 w-3.5" />Email verified</span></div></div>
        <Link href="/customer/settings" className="mt-6 flex h-10 items-center justify-center gap-2 rounded-full border border-ink-200 text-sm font-semibold text-ink-700 hover:bg-ink-50">Manage profile<ArrowRight className="h-4 w-4" /></Link>
      </section>

      {subscription ? <section className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white sm:p-7"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-[80px]" /><div className="relative"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><span className="inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold">{subscription.status}</span><h2 className="mt-4 text-3xl font-bold">{subscription.plan} plan</h2><p className="mt-1 text-sm text-white/45">{subscription.storeName} · {subscription.storeType}</p></div><div className="sm:text-right"><strong className="text-2xl sm:text-3xl">{subscription.price}</strong><p className="text-xs text-white/35">per month</p></div></div><div className="my-6 h-px bg-white/10" /><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-white/[.06] p-4"><p className="flex items-center gap-2 text-xs text-white/40"><CalendarDays className="h-4 w-4" />Subscription purchased</p><p className="mt-2 text-sm font-semibold">{subscription.purchaseDate}</p></div><div className="rounded-xl bg-white/[.06] p-4"><p className="flex items-center gap-2 text-xs text-white/40"><CreditCard className="h-4 w-4" />Next billing date</p><p className="mt-2 text-sm font-semibold">{subscription.nextBillingDate}</p></div></div><Link href="/customer/subscription" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">Manage subscription<ArrowRight className="h-4 w-4" /></Link></div></section> : <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white p-6 text-center"><Store className="h-10 w-10 text-ink-300" /><h2 className="mt-4 text-xl font-bold text-ink-900">No active subscription</h2><p className="mt-2 max-w-sm text-sm text-ink-500">Choose a Unity Commerce plan to set up your online store.</p><Link href="/products/unitycommerce#pricing" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white">View plans<ArrowRight className="h-4 w-4" /></Link></section>}
    </div>

    <section className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-brand"><ReceiptText className="h-4 w-4" /></span><div><h2 className="font-bold text-ink-900">Billing history</h2><p className="text-xs text-ink-400">Your latest subscription payments</p></div></div><Link href="/customer/subscription" className="text-xs font-semibold text-brand">View billing details</Link></div>
      <div className="overflow-x-auto"><div className="min-w-[620px]">{(subscription?.billingHistory ?? []).length ? <>{subscription?.billingHistory.map((invoice) => <div key={invoice.id} className="grid grid-cols-[1.1fr_1fr_.7fr_.55fr] items-center gap-4 border-b border-ink-100 px-6 py-4 last:border-0"><div><p className="text-sm font-semibold text-ink-800">{invoice.description}</p><p className="mt-1 text-[10px] text-ink-400">{invoice.id}</p></div><p className="text-sm text-ink-500">{invoice.date}</p><p className="text-sm font-semibold text-ink-900">{invoice.amount}</p><span className="w-fit rounded-full bg-success-50 px-2.5 py-1 text-[10px] font-semibold text-success-700">{invoice.status}</span></div>)}</> : <div className="flex min-h-36 items-center justify-center p-6 text-sm text-ink-400">No billing activity yet.</div>}</div></div>
    </section>
  </div>;
}
