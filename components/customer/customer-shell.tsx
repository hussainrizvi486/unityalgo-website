'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, CreditCard, Headphones, LogOut, Menu, Settings, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { clearCustomerSession, CustomerProfile, readCustomerSession } from '@/lib/customer-mock';
import { cn } from '@/utils';

const navItems = [
  { label: 'Overview', href: '/customer', icon: BarChart3 },
  { label: 'Subscription', href: '/customer/subscription', icon: CreditCard },
  { label: 'Support', href: '/customer/support', icon: Headphones },
  { label: 'Settings', href: '/customer/settings', icon: Settings },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CustomerProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      const session = readCustomerSession();
      if (!session) router.replace(`/customer/login?next=${encodeURIComponent(pathname)}`);
      else setUser(session.user);
    };
    syncSession();
    window.addEventListener('unityalgo-customer-session', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('unityalgo-customer-session', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [pathname, router]);

  function logout() {
    clearCustomerSession();
    router.replace('/customer/login');
  }

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-ink-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand" /></div>;

  return (
    <div className="min-h-screen bg-ink-50 lg:grid lg:grid-cols-[264px_1fr]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-200 bg-white px-4 lg:hidden"><Logo className="h-10" /><button onClick={() => setMenuOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-ink-700 hover:bg-ink-50"><Menu className="h-5 w-5" /></button></header>
      {menuOpen ? <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col border-r border-ink-200 bg-white p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', menuOpen && 'translate-x-0')}>
        <div className="flex h-14 items-center justify-between px-2"><Logo className="h-10" /><button onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-ink-500 lg:hidden"><X className="h-5 w-5" /></button></div>
        <div className="mt-7 rounded-2xl bg-ink-950 p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Customer panel</p><div className="mt-4 flex items-center gap-3">{user.avatar ? <Image src={user.avatar} alt={`${user.firstName} ${user.lastName}`} width={40} height={40} unoptimized className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-bold">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>}<div className="min-w-0"><p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p><p className="truncate text-xs text-white/40">{user.email}</p></div></div></div>
        <nav className="mt-6 space-y-1.5" aria-label="Customer panel">
          {navItems.map((item) => { const active = item.href === '/customer' ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', active ? 'bg-accent text-brand' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-950')}><item.icon className="h-4 w-4" />{item.label}</Link>; })}
        </nav>
        <button onClick={logout} className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-500 transition-colors hover:bg-error-50 hover:text-error-700"><LogOut className="h-4 w-4" />Log out</button>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
