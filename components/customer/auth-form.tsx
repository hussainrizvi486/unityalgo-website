'use client';

import { Notice } from '@/components/ui/notice';
import Link from 'next/link';
import Image from "next/image"
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { loginAction } from '@/app/login/actions';


export function AuthFrame({ children, eyebrow, title, description }: { children: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <main className="min-h-screen bg-card px-page py-10 sm:py-section">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6">
          <div >
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="UnityAlgo"
                className="size-8 sm:h-12 sm:w-12"
                width='40'
                height='40'
                loading="eager"
              />
              <div className="font-bold sm:text-lg font-logo">UnityAlgo</div>
            </Link>
          </div>
        </div>
        <div>
          {/* <div className="rounded-2xl border border-border bg-card p-card shadow-lg sm:p-8"> */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-eyebrow text-primary">{eyebrow}</p>
          </div>
          <h1 className=" text-xl tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
      {pending ? pendingLabel : label}<ArrowRight className="h-4 w-4" />
    </Button>
  );
}

export function CustomerAuthForm() {
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(loginAction, undefined);
  // No default: an admin signing in should not be pushed at /dashboard. The
  // action picks the right home for the role when `next` is empty.
  const next = searchParams.get('next') ?? '';
  const query = next ? new URLSearchParams({ next }).toString() : '';
  const resetSuccess = searchParams.get('reset') === 'success';

  // Controlled, so a rejected sign-in keeps the address that was typed.
  // React resets an uncontrolled form after a form action completes, which is
  // why the field used to come back empty and the whole thing had to be
  // retyped. The password is deliberately not restored — it is never echoed
  // back from the server, and re-entering it is the expected cost of a miss.
  const [email, setEmail] = useState(state?.email ?? '');

  return (
    <AuthFrame eyebrow="Welcome back" title="Sign in to your Account" description="Manage your subscriptions and support from one secure place.">
      {resetSuccess ? (
        <Notice tone="success" className="mb-4">Your password has been reset. Sign in with your new password.</Notice>
      ) : null}
      <form action={formAction} className="space-y-gap">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email" className="mb-1.5 text-sm text-foreground/80">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-9"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="text-sm text-foreground/80">Password</Label>
            <Link href="/customer/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            icon
            placeholder="********"
          />
        </div>
        {state?.error ? <Notice tone="error">{state.error}</Notice> : null}
        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New to UnityAlgo? <Link href={query ? `/register?${query}` : "/register"} className="font-semibold text-primary hover:underline">Create account</Link>
      </p>
      <div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />Your details are encrypted and never shared</div>
    </AuthFrame>
  );
}
