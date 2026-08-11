'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { Camera, CheckCircle2, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readCustomerSession, saveCustomerSession } from '@/lib/customer-mock';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', avatar: '' });
  const [imageError, setImageError] = useState('');
  useEffect(() => { const session = readCustomerSession(); if (session) setProfile({ ...session.user, avatar: session.user.avatar ?? '' }); }, []);
  function save(event: FormEvent) { event.preventDefault(); const session = readCustomerSession(); if (session) saveCustomerSession({ ...session, user: { ...session.user, ...profile } }); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
  function changeAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (!file.type.startsWith('image/')) return setImageError('Choose a PNG, JPG or WebP image.');
    if (file.size > 5 * 1024 * 1024) return setImageError('Choose an image smaller than 5 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      const source = new window.Image();
      source.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) return setImageError('Unable to process this image.');
        const crop = Math.min(source.width, source.height);
        context.drawImage(source, (source.width - crop) / 2, (source.height - crop) / 2, crop, crop, 0, 0, size, size);
        const avatar = canvas.toDataURL('image/jpeg', .82);
        setProfile((value) => ({ ...value, avatar }));
        const session = readCustomerSession();
        if (session) saveCustomerSession({ ...session, user: { ...session.user, avatar } });
      };
      source.onerror = () => setImageError('Unable to read this image.');
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  return <div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Settings</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Account settings</h1><p className="mt-2 text-sm text-ink-500">Manage your personal information, email and security.</p>
    <form onSubmit={save} className="mt-8 space-y-6"><section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><UserRound className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Profile details</h2></div><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="relative w-fit">{profile.avatar ? <Image src={profile.avatar} alt="Profile preview" width={80} height={80} unoptimized className="h-20 w-20 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-950 text-xl font-bold text-white">{profile.firstName.charAt(0)}{profile.lastName.charAt(0)}</span>}<label htmlFor="avatar" aria-label="Change profile photo" className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand text-white"><Camera className="h-3.5 w-3.5" /></label><input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} className="sr-only" /></div><div><p className="text-sm font-semibold text-ink-800">Profile picture</p><p className="mt-1 text-xs text-ink-400">PNG, JPG or WebP, up to 5 MB</p><label htmlFor="avatar" className="mt-2 inline-block cursor-pointer text-xs font-semibold text-brand">Upload new photo</label>{imageError ? <p role="alert" className="mt-2 text-xs text-error-700">{imageError}</p> : null}</div></div><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="firstName" className="mb-1.5 text-sm text-ink-700">First name</Label><Input id="firstName" required className="h-11 rounded-xl" value={profile.firstName} onChange={(event) => setProfile((value) => ({ ...value, firstName: event.target.value }))} /></div><div><Label htmlFor="lastName" className="mb-1.5 text-sm text-ink-700">Last name</Label><Input id="lastName" required className="h-11 rounded-xl" value={profile.lastName} onChange={(event) => setProfile((value) => ({ ...value, lastName: event.target.value }))} /></div></div></section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><Mail className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Email address</h2></div><Label htmlFor="email" className="mb-1.5 text-sm text-ink-700">Account email</Label><Input id="email" type="email" required className="h-11 max-w-xl rounded-xl" value={profile.email} onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))} /><div className="mt-4 flex gap-3 rounded-xl bg-warning-50 p-4 text-sm text-warning-700"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>When email APIs are connected, changing this address will first verify your current email and then verify the new email.</p></div></section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><KeyRound className="h-5 w-5 text-brand" /><h2 className="font-bold text-ink-900">Change password</h2></div><div className="grid gap-5 lg:grid-cols-3"><div><Label htmlFor="currentPassword" className="mb-1.5 text-sm text-ink-700">Current password</Label><Input id="currentPassword" type="password" className="h-11 rounded-xl" /></div><div><Label htmlFor="newPassword" className="mb-1.5 text-sm text-ink-700">New password</Label><Input id="newPassword" type="password" className="h-11 rounded-xl" /></div><div><Label htmlFor="confirmNewPassword" className="mb-1.5 text-sm text-ink-700">Confirm password</Label><Input id="confirmNewPassword" type="password" className="h-11 rounded-xl" /></div></div></section>
      <div className="flex items-center gap-4"><Button type="submit" className="h-11 rounded-full bg-brand px-7 text-white hover:brightness-90">Save changes</Button>{saved ? <span className="flex items-center gap-2 text-sm text-success-600"><CheckCircle2 className="h-4 w-4" />Changes saved</span> : null}</div></form>
  </div>;
}
