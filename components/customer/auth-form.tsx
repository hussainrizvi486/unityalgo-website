'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { mockVerificationCode, readPendingCustomer, saveCustomerSession, savePendingCustomer } from '@/lib/customer-mock';

const fieldClass = 'h-11 rounded-xl border-ink-200 bg-white px-4 focus-visible:ring-brand/20';

function AuthFrame({ children, eyebrow, title, description }: { children: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-ink-200 bg-white shadow-[0_30px_90px_rgba(21,21,21,.10)] lg:grid-cols-[.85fr_1.15fr]">
        <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-36 -top-24 h-96 w-96 rounded-full bg-brand/30 blur-[100px]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative z-10 -ml-10 w-60 rounded-r-2xl bg-white pb-4 pt-3 pl-10 pr-3 text-ink-950"><Logo className="h-10" /></div>
          <div className="relative z-10">
            <span className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.18em] text-white/60">Unity Commerce</span>
            <h2 className="max-w-sm text-4xl font-bold tracking-tight">Your business, ready for what comes next.</h2>
            <div className="mt-8 space-y-4 text-sm text-white/60">
              {['Secure customer access', 'Guided store setup', 'Subscription management in one place'].map((item) => <div key={item} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand"><Check className="h-3.5 w-3.5 text-white" /></span>{item}</div>)}
            </div>
          </div>
          <p className="relative z-10 text-xs text-white/35">Protected by UnityAlgo security controls</p>
        </aside>
        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-lg">
            <div className="mb-10 inline-flex lg:hidden"><Logo /></div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-brand">{eyebrow}</p>
            <h1 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">{title}</h1>
            <p className="mb-8 mt-3 text-sm leading-6 text-ink-500">{description}</p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export function CustomerAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const plan = searchParams.get('plan') ?? '';
  const next = searchParams.get('next') ?? '/customer';
  const query = new URLSearchParams({ next, ...(plan ? { plan } : {}) }).toString();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (mode === 'register') {
      const confirmPassword = String(data.get('confirmPassword') ?? '');
      if (password.length < 8) return setError('Use at least 8 characters for your password.');
      if (password !== confirmPassword) return setError('Passwords do not match.');
      savePendingCustomer({ firstName: String(data.get('firstName')), lastName: String(data.get('lastName')), email });
      router.push(`/customer/verify-email?${query}`);
      return;
    }

    if (!email || password.length < 8) return setError('Enter a valid email and a password of at least 8 characters.');
    const firstName = email.split('@')[0]?.split(/[._-]/)[0] || 'Customer';
    saveCustomerSession({ user: { firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1), lastName: '', email } });
    router.push(plan ? `/customer/onboarding?plan=${encodeURIComponent(plan)}` : next);
  }

  return (
    <AuthFrame eyebrow={mode === 'login' ? 'Welcome back' : 'Create your account'} title={mode === 'login' ? 'Sign in to your customer panel' : 'Start building your online store'} description={mode === 'login' ? 'Manage your subscription, store and support from one secure place.' : 'Create your UnityAlgo customer account. Your store setup comes next.'}>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' ? <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="firstName" className="mb-1.5 text-sm text-ink-700">First name</Label><Input id="firstName" name="firstName" required autoComplete="given-name" className={fieldClass} placeholder="John" /></div>
          <div><Label htmlFor="lastName" className="mb-1.5 text-sm text-ink-700">Last name</Label><Input id="lastName" name="lastName" required autoComplete="family-name" className={fieldClass} placeholder="Doe" /></div>
        </div> : null}
        <div><Label htmlFor="email" className="mb-1.5 text-sm text-ink-700">Email address</Label><div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" /><Input id="email" name="email" type="email" required autoComplete="email" className={`${fieldClass} pl-10`} placeholder="you@company.com" /></div></div>
        <div><Label htmlFor="password" className="mb-1.5 text-sm text-ink-700">Password</Label><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" /><Input id="password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={`${fieldClass} px-10`} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-3 text-ink-400 hover:text-ink-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        {mode === 'register' ? <div><Label htmlFor="confirmPassword" className="mb-1.5 text-sm text-ink-700">Confirm password</Label><Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className={fieldClass} placeholder="Repeat your password" /></div> : null}
        {error ? <p role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700">{error}</p> : null}
        <Button type="submit" className="h-12 w-full rounded-full bg-brand text-white hover:brightness-90">{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight className="h-4 w-4" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">{mode === 'login' ? 'New to UnityAlgo?' : 'Already have an account?'} <Link href={`/customer/${mode === 'login' ? 'register' : 'login'}?${query}`} className="font-semibold text-brand hover:underline">{mode === 'login' ? 'Create account' : 'Sign in'}</Link></p>
      <div className="mt-7 flex items-center justify-center gap-2 text-xs text-ink-400"><ShieldCheck className="h-4 w-4" />Mock authentication for design preview</div>
    </AuthFrame>
  );
}

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const pending = readPendingCustomer();
  const plan = searchParams.get('plan') ?? '';
  const next = searchParams.get('next') ?? '/customer';

  function verify(event: FormEvent) {
    event.preventDefault();
    if (code !== mockVerificationCode) return setError('That code is not correct. Use the preview code shown below.');
    const user = pending ?? { firstName: 'Customer', lastName: '', email: 'customer@example.com' };
    saveCustomerSession({ user });
    router.push(plan ? `/customer/onboarding?plan=${encodeURIComponent(plan)}` : next);
  }

  return <AuthFrame eyebrow="Verify email" title="Check your inbox" description={`We sent a six-digit verification code to ${pending?.email ?? 'your email address'}.`}>
    <form onSubmit={verify} className="space-y-5">
      <div><Label htmlFor="code" className="mb-2 text-sm text-ink-700">Verification code</Label><Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="h-14 rounded-xl border-ink-200 text-center text-xl font-bold tracking-[.45em]" placeholder="000000" /></div>
      <div className="rounded-xl border border-warning-500/20 bg-warning-50 px-4 py-3 text-sm text-warning-700">Design preview code: <strong>{mockVerificationCode}</strong></div>
      {error ? <p role="alert" className="text-sm text-error-700">{error}</p> : null}
      <Button type="submit" className="h-12 w-full rounded-full bg-brand text-white hover:brightness-90">Verify email<ArrowRight className="h-4 w-4" /></Button>
    </form>
  </AuthFrame>;
}
