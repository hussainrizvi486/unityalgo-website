'use client';

import { Notice } from '@/components/ui/notice';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, KeyRound, Mail, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvatarUrl } from '@/lib/use-avatar';


interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone: string;
  company: string;
  companyEmail: string;
}

export function SettingsClient({ profile }: { profile: Profile }) {
  const searchParams = useSearchParams();
  const avatar = useAvatarUrl();

  const profileUpdated = searchParams.get('profileUpdated') === '1';

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Settings</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Account settings</h1>
      <p className="mt-2 text-sm text-ink-500">Manage your personal information, email and security.</p>

      {profileUpdated ? (
        <Notice tone="success" className="mt-6">Profile updated.</Notice>
      ) : null}

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Profile details</h2></div>
            <Link href="/dashboard/settings/profile" className="flex items-center gap-1.5 text-sm font-semibold text-link hover:underline">Change<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-5 flex items-center gap-4">
            {avatar ? (
              <Image src={avatar} alt="Profile" width={64} height={64} unoptimized className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-ink-950 text-lg font-bold text-white">{profile.firstName.charAt(0)}{profile.lastName.charAt(0)}</span>
            )}
            <div>
              <p className="text-lg font-semibold text-ink-900">{profile.firstName} {profile.lastName}</p>
              {profile.username ? <p className="text-sm text-ink-500">@{profile.username}</p> : null}
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Mobile number</dt>
              <dd className="mt-1 text-sm text-ink-700">{profile.phone || <span className="text-ink-400">Not set</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Company</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-ink-700">
                {profile.company ? <><Building2 className="h-3.5 w-3.5 text-ink-400" />{profile.company}</> : <span className="text-ink-400">Not set</span>}
              </dd>
            </div>
            {profile.companyEmail ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Company email</dt>
                <dd className="mt-1 text-sm text-ink-700">{profile.companyEmail}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3"><Mail className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Email address</h2></div>
          <Input id="email" type="email" required disabled className="max-w-xl bg-ink-50 text-ink-500" value={profile.email} />
          <div className="mt-4 flex gap-3 rounded-lg bg-warning-50 p-4 text-sm text-warning-700"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>When email APIs are connected, changing this address will first verify your current email and then verify the new email.</p></div>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Addresses</h2></div>
            <Link href="/dashboard/settings/addresses" className="flex items-center gap-1.5 text-sm font-semibold text-link hover:underline">Manage addresses<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <p className="mt-4 text-sm text-ink-500">Add and manage your saved addresses, and choose a default.</p>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Password</h2></div>
          </div>
          <p className="mt-4 text-sm text-ink-500">Change the password used to sign in to your account.</p>
          <Link href="/dashboard/settings/password">
            <Button variant="outline" className="mt-4">Change password</Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
