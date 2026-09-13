'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { BarChart3, CreditCard, Headphones, Layers, LogOut, Settings } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { customerLogoutAction } from '@/app/customer/actions';
import { useAvatarUrl } from '@/lib/use-avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Plans', href: '/dashboard/plans', icon: Layers },
  { label: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
  { label: 'Support', href: '/dashboard/support', icon: Headphones },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface CustomerShellUser {
  firstName: string;
  lastName: string;
  email: string;
}

export function CustomerShell({ children, user }: { children: React.ReactNode; user: CustomerShellUser }) {
  const pathname = usePathname();
  const avatarUrl = useAvatarUrl();

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 overflow-hidden px-2 py-1.5">
            <Logo className="h-8 shrink-0" />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator className="mb-1" />
          <div className="flex items-center gap-2.5 overflow-hidden rounded-md px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={fullName} width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{initials}</span>
            )}
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-ink-900">{fullName}</p>
              <p className="truncate text-xs text-ink-400">{user.email}</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <form action={customerLogoutAction}>
                <SidebarMenuButton type="submit" tooltip="Log out" className="text-ink-500 hover:bg-error-50 hover:text-error-700">
                  <LogOut />
                  <span>Log out</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4 lg:hidden">
          <SidebarTrigger />
          <Logo className="h-8" />
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
