'use client';

import { Notice } from '@/components/ui/notice';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Mail, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Logo } from '@/components/Logo';
import { CheckoutEventNames, initializePaddle } from '@paddle/paddle-js';
import { startPlanCheckoutBySlugAction } from '@/app/customer/actions';

interface Profile {
  firstName: string;
  lastName: string;
  email: string;
}

export function OnboardingFlow({ profile, planName, planPrice }: {
  profile: Profile;
  /** Resolved server-side from the plan row, so it matches what is charged. */
  planName: string;
  /** Formatted price, or null for a custom-quote plan. */
  planPrice: string | null;
}) {
  const router = useRouter();
  const plan = planName;
  const [step, setStep] = useState(1);
  const [storeData, setStoreData] = useState({ storeName: '', storeType: 'Fashion & apparel', storeEmail: '', storePassword: '' });
  const [paymentError, setPaymentError] = useState('');
  const [openingCheckout, setOpeningCheckout] = useState(false);

  function saveStore(event: FormEvent) {
    event.preventDefault();
    setStep(2);
  }

  function completePayment() {
    setStep(3);
  }

  async function openPaddleCheckout() {
    setPaymentError('');
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setPaymentError('Online payment is not configured yet. Please contact support.');
      return;
    }
    setOpeningCheckout(true);
    try {
      const intent = await startPlanCheckoutBySlugAction(plan);
      if (!intent.ok || !intent.priceId) {
        setPaymentError(intent.error ?? 'Could not start checkout.');
        return;
      }
      const paddle = await initializePaddle({
        token,
        environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
        eventCallback: (event) => {
          if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) completePayment();
        },
      });
      if (!paddle) throw new Error('Paddle.js did not initialize.');
      paddle.Checkout.open({
        items: [{ priceId: intent.priceId, quantity: 1 }],
        customer: { email: profile.email },
        customData: { ...intent.customData, store_name: storeData.storeName || 'My Unity Store' },
        settings: { displayMode: 'overlay', variant: 'one-page', theme: 'light', locale: 'en', allowLogout: false },
      });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to open Paddle checkout.');
    } finally {
      setOpeningCheckout(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted px-page py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between gap-gap"><Logo /><Link href="/products/unitycommerce" className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"><ArrowLeft className="h-4 w-4" />Back to plans</Link></header>
        <div className="mb-7 grid grid-cols-3 gap-2">
          {['Store setup', 'Payment', 'Complete'].map((label, index) => <div key={label} className="flex items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step > index ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-border'}`}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`hidden text-xs font-semibold sm:block ${step > index ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>{index < 2 ? <span className="h-px flex-1 bg-border" /> : null}</div>)}
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card p-card shadow-xl sm:p-10">
          {step === 1 ? <>
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary"><Store className="h-5 w-5" /></span>
            <h1 className="text-3xl tracking-tight text-foreground">Tell us about your store</h1><p className="mb-8 mt-2 text-sm text-muted-foreground">These details prepare your Unity Commerce workspace.</p>
            <form onSubmit={saveStore} className="space-y-5">
              <div><Label htmlFor="storeName" className="mb-1.5 text-sm text-foreground/80">Store name</Label><Input id="storeName" required placeholder="e.g. North & Co." value={storeData.storeName} onChange={(event) => setStoreData((value) => ({ ...value, storeName: event.target.value }))} /></div>
              <div><Label htmlFor="storeType" className="mb-1.5 text-sm text-foreground/80">Store type</Label><select id="storeType" value={storeData.storeType} onChange={(event) => setStoreData((value) => ({ ...value, storeType: event.target.value }))} className="h-9 w-full rounded border border-input bg-transparent px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"><option>Fashion & apparel</option><option>Beauty & wellness</option><option>Electronics</option><option>Food & grocery</option><option>Home & lifestyle</option><option>Other</option></select></div>
              <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="storeEmail" className="mb-1.5 text-sm text-foreground/80">Store email</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="storeEmail" type="email" required className="pl-9" placeholder="store@company.com" value={storeData.storeEmail} onChange={(event) => setStoreData((value) => ({ ...value, storeEmail: event.target.value }))} /></div></div><div><Label htmlFor="storePassword" className="mb-1.5 text-sm text-foreground/80">Store password</Label><PasswordInput id="storePassword" minLength={8} required icon placeholder="Minimum 8 characters" value={storeData.storePassword} onChange={(event) => setStoreData((value) => ({ ...value, storePassword: event.target.value }))} /></div></div>
              <Button type="submit" className="h-12 bg-primary px-7 text-primary-foreground hover:bg-primary/90">Continue to payment<ArrowRight className="h-4 w-4" /></Button>
            </form>
          </> : null}

          {step === 2 ? <>
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary"><CreditCard className="h-5 w-5" /></span>
            <h1 className="text-3xl tracking-tight text-foreground">Complete your subscription</h1><p className="mb-8 mt-2 text-sm text-muted-foreground">Payment will be securely processed through Paddle.</p>
            <div className="rounded-xl border border-border bg-muted p-card"><div className="flex flex-col gap-gap sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-foreground">Paddle Secure Checkout</p><p className="mt-1 text-xs text-muted-foreground">Paddle handles payment details, tax and subscription creation.</p></div><div className="w-fit rounded-md bg-card px-3 py-2 text-sm font-bold text-foreground shadow-sm">paddle</div></div><div className="my-5 h-px bg-border" /><div className="flex items-start gap-3 text-sm leading-6 text-foreground/70"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" /><p>Your payment details open in Paddle’s PCI-compliant checkout. UnityAlgo never stores your card information.</p></div></div>
            {paymentError ? <Notice tone="error" className="mt-4 leading-6">{paymentError}</Notice> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" onClick={() => setStep(1)} className="h-12 px-6">Back</Button><Button onClick={openPaddleCheckout} disabled={openingCheckout} className="h-12 bg-primary px-7 text-primary-foreground hover:bg-primary/90">{openingCheckout ? 'Opening checkout...' : 'Pay securely with Paddle'}<ArrowRight className="h-4 w-4" /></Button></div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Sandbox checkout is used until production credentials are configured.</p>
          </> : null}

          {step === 3 ? <div className="flex min-h-96 flex-col items-center justify-center text-center"><span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-8 w-8" /></span><h1 className="text-3xl tracking-tight text-foreground">Your store is ready</h1><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Your {plan} subscription is active and your customer panel is ready to use.</p><Button onClick={() => router.push('/dashboard')} className="mt-7 h-12 bg-primary px-7 text-primary-foreground hover:bg-primary/90">Open customer panel<ArrowRight className="h-4 w-4" /></Button></div> : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {plan} plan{planPrice ? ` · ${planPrice} per month` : ''}
        </p>
      </div>
    </main>
  );
}
