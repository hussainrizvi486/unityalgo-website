'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, LockKeyhole, Mail, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { planPrice, readCustomerSession, saveCustomerSession } from '@/lib/customer-mock';
import { CheckoutEventNames, initializePaddle } from '@paddle/paddle-js';

const inputClass = 'h-11 rounded-xl border-ink-200 bg-white px-4';

export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') ?? 'Growth';
  const [step, setStep] = useState(1);
  const [storeData, setStoreData] = useState({ storeName: '', storeType: 'Fashion & apparel', storeEmail: '', storePassword: '' });
  const [paymentError, setPaymentError] = useState('');
  const [openingCheckout, setOpeningCheckout] = useState(false);

  useEffect(() => {
    if (!readCustomerSession()) router.replace(`/customer/login?next=/customer/onboarding&plan=${encodeURIComponent(plan)}`);
  }, [plan, router]);

  function saveStore(event: FormEvent) {
    event.preventDefault();
    setStep(2);
  }

  function completePayment(transactionId?: string) {
    const session = readCustomerSession();
    if (!session) return;
    saveCustomerSession({ user: session.user, subscription: { plan, price: planPrice(plan), status: 'Active', purchaseDate: 'August 12, 2026', nextBillingDate: 'September 12, 2026', storeName: storeData.storeName || 'My Unity Store', storeType: storeData.storeType, transactionId, billingHistory: [{ id: transactionId ?? 'txn_preview_001', date: 'August 12, 2026', description: `${plan} plan`, amount: planPrice(plan), status: 'Paid' }] } });
    setStep(3);
  }

  async function openPaddleCheckout() {
    setPaymentError('');
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const priceIds: Record<string, string | undefined> = {
      Starter: process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID,
      Growth: process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID,
      Professional: process.env.NEXT_PUBLIC_PADDLE_PROFESSIONAL_PRICE_ID,
      Enterprise: process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID,
    };
    const priceId = priceIds[plan];
    if (!token || !priceId) {
      setPaymentError('Paddle checkout needs a sandbox client-side token and a price ID for this plan. Add them to your environment configuration and restart the app.');
      return;
    }
    setOpeningCheckout(true);
    try {
      const session = readCustomerSession();
      const paddle = await initializePaddle({
        token,
        environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
        eventCallback: (event) => {
          if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) completePayment(event.data?.transaction_id);
        },
      });
      if (!paddle) throw new Error('Paddle.js did not initialize.');
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: session?.user.email ? { email: session.user.email } : undefined,
        customData: { plan, store_name: storeData.storeName || 'My Unity Store' },
        settings: { displayMode: 'overlay', variant: 'one-page', theme: 'light', locale: 'en', allowLogout: false },
      });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to open Paddle checkout.');
    } finally {
      setOpeningCheckout(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4"><Logo /><Link href="/products/unitycommerce" className="flex items-center gap-2 text-xs font-medium text-ink-500 hover:text-ink-900 sm:text-sm"><ArrowLeft className="h-4 w-4" />Back to plans</Link></header>
        <div className="mb-7 grid grid-cols-3 gap-2">
          {['Store setup', 'Payment', 'Complete'].map((label, index) => <div key={label} className="flex items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step > index ? 'bg-brand text-white' : 'bg-white text-ink-400 ring-1 ring-ink-200'}`}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`hidden text-xs font-semibold sm:block ${step > index ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>{index < 2 ? <span className="h-px flex-1 bg-ink-200" /> : null}</div>)}
        </div>

        <div className="grid overflow-hidden rounded-[2rem] border border-ink-200 bg-white shadow-[0_25px_70px_rgba(21,21,21,.08)] lg:grid-cols-[1fr_300px]">
          <section className="p-6 sm:p-10">
            {step === 1 ? <>
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-brand"><Store className="h-5 w-5" /></span>
              <h1 className="text-3xl font-bold tracking-tight text-ink-950">Tell us about your store</h1><p className="mb-8 mt-2 text-sm text-ink-500">These details prepare your Unity Commerce workspace.</p>
              <form onSubmit={saveStore} className="space-y-5">
                <div><Label htmlFor="storeName" className="mb-1.5 text-sm text-ink-700">Store name</Label><Input id="storeName" required className={inputClass} placeholder="e.g. North & Co." value={storeData.storeName} onChange={(event) => setStoreData((value) => ({ ...value, storeName: event.target.value }))} /></div>
                <div><Label htmlFor="storeType" className="mb-1.5 text-sm text-ink-700">Store type</Label><select id="storeType" value={storeData.storeType} onChange={(event) => setStoreData((value) => ({ ...value, storeType: event.target.value }))} className="h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"><option>Fashion & apparel</option><option>Beauty & wellness</option><option>Electronics</option><option>Food & grocery</option><option>Home & lifestyle</option><option>Other</option></select></div>
                <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="storeEmail" className="mb-1.5 text-sm text-ink-700">Store email</Label><div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" /><Input id="storeEmail" type="email" required className={`${inputClass} pl-10`} placeholder="store@company.com" value={storeData.storeEmail} onChange={(event) => setStoreData((value) => ({ ...value, storeEmail: event.target.value }))} /></div></div><div><Label htmlFor="storePassword" className="mb-1.5 text-sm text-ink-700">Store password</Label><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" /><Input id="storePassword" type="password" minLength={8} required className={`${inputClass} pl-10`} placeholder="Minimum 8 characters" value={storeData.storePassword} onChange={(event) => setStoreData((value) => ({ ...value, storePassword: event.target.value }))} /></div></div></div>
                <Button type="submit" className="h-12 rounded-full bg-brand px-7 text-white hover:brightness-90">Continue to payment<ArrowRight className="h-4 w-4" /></Button>
              </form>
            </> : null}

            {step === 2 ? <>
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-brand"><CreditCard className="h-5 w-5" /></span>
              <h1 className="text-3xl font-bold tracking-tight text-ink-950">Complete your subscription</h1><p className="mb-8 mt-2 text-sm text-ink-500">Payment will be securely processed through Paddle.</p>
              <div className="rounded-2xl border border-ink-200 bg-ink-50 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-ink-900">Paddle Secure Checkout</p><p className="mt-1 text-xs text-ink-500">Paddle handles payment details, tax and subscription creation.</p></div><div className="w-fit rounded-lg bg-white px-3 py-2 text-sm font-bold text-ink-800 shadow-sm">paddle</div></div><div className="my-5 h-px bg-ink-200" /><div className="flex items-start gap-3 text-sm leading-6 text-ink-600"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-600" /><p>Your payment details open in Paddle’s PCI-compliant checkout. UnityAlgo never stores your card information.</p></div></div>
              {paymentError ? <p role="alert" className="mt-4 rounded-xl bg-error-50 px-4 py-3 text-sm leading-6 text-error-700">{paymentError}</p> : null}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" onClick={() => setStep(1)} className="h-12 rounded-full px-6">Back</Button><Button onClick={openPaddleCheckout} disabled={openingCheckout} className="h-12 rounded-full bg-brand px-7 text-white hover:brightness-90">{openingCheckout ? 'Opening checkout...' : 'Pay securely with Paddle'}<ArrowRight className="h-4 w-4" /></Button></div>
              <p className="mt-5 flex items-center gap-2 text-xs text-ink-400"><ShieldCheck className="h-4 w-4" />Sandbox checkout is used until production credentials are configured.</p>
            </> : null}

            {step === 3 ? <div className="flex min-h-96 flex-col items-center justify-center text-center"><span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-success-600"><CheckCircle2 className="h-8 w-8" /></span><h1 className="text-3xl font-bold tracking-tight text-ink-950">Your store is ready</h1><p className="mt-3 max-w-md text-sm leading-6 text-ink-500">Your {plan} subscription is active and your customer panel is ready to use.</p><Button onClick={() => router.push('/customer')} className="mt-7 h-12 rounded-full bg-brand px-7 text-white hover:brightness-90">Open customer panel<ArrowRight className="h-4 w-4" /></Button></div> : null}
          </section>
          <aside className="border-t border-ink-200 bg-ink-950 p-6 text-white lg:border-l lg:border-t-0 lg:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/40">Order summary</p><h2 className="mt-6 text-2xl font-bold">{plan}</h2><p className="mt-1 text-sm text-white/45">Unity Commerce plan</p><div className="my-6 h-px bg-white/10" /><div className="space-y-3 text-sm text-white/60">{['Secure cloud hosting', 'Professional themes', 'Automatic updates', 'SSL certificate'].map((item) => <div key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-white" />{item}</div>)}</div><div className="my-6 h-px bg-white/10" /><div className="flex items-end justify-between"><span className="text-sm text-white/45">Monthly total</span><div className="text-right"><strong className="text-2xl">{planPrice(plan)}</strong><span className="block text-xs text-white/35">per month</span></div></div></aside>
        </div>
      </div>
    </main>
  );
}
