'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    BarChart3,
    CreditCard,
    Headphones,
    Layers,
    LogOut,
    Settings,
    AppWindow,
    Globe,
    Component,
} from 'lucide-react';
import { NotificationBell } from './notification-bell';
import type { listNotifications } from '@/lib/customer-notifications';
import { Logo } from '@/components/Logo';
import { customerLogoutAction } from '@/app/customer/actions';
import { useAvatarUrl } from '@/lib/use-avatar';
import { ThemeScope } from '@/components/ui/theme-scope';
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
    { label: 'Sites', href: '/dashboard/sites', icon: Globe },
    { label: 'App Store', href: '/dashboard/app-store', icon: AppWindow },
    { label: 'Plans', href: '/dashboard/plans', icon: Layers },
    {
        label: 'Subscription',
        href: '/dashboard/subscription',
        icon: CreditCard,
    },
    { label: 'Support', href: '/dashboard/support', icon: Headphones },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Components', href: '/dashboard/components', icon: Component },
];

interface CustomerShellUser {
    firstName: string;
    lastName: string;
    email: string;
}

export function CustomerShell({
    children,
    user,
    notifications,
    themeClassName,
}: {
    children: React.ReactNode;
    user: CustomerShellUser;
    notifications: Awaited<ReturnType<typeof listNotifications>>;
    themeClassName: string;
}) {
    const pathname = usePathname();
    const avatarUrl = useAvatarUrl();

    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
    const initials =
        `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() ||
        user.email.charAt(0).toUpperCase();

    return (
        <ThemeScope.Provider value={themeClassName}>
            <SidebarProvider className={`${themeClassName} text-foreground`}>
                <Sidebar collapsible="icon">
                    <SidebarHeader className="border-b border-sidebar-border">
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 overflow-hidden rounded-md px-2 py-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            <Image src="/logo.svg" alt="" width={28} height={28} className="size-8.5 shrink-0" priority />
                            <span className="truncate font-logo text-[1rem] font-bold leading-none text-ink-900 group-data-[collapsible=icon]:hidden">
                                UnityAlgo
                            </span>
                        </Link>
                    </SidebarHeader>
                    <SidebarSeparator />
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navItems.map((item) => {
                                        const active =
                                            item.href === '/dashboard'
                                                ? pathname === item.href
                                                : pathname.startsWith(
                                                    item.href,
                                                );
                                        return (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={active}
                                                    tooltip={item.label}
                                                >
                                                    <Link href={item.href}>
                                                        <item.icon />
                                                        <span>
                                                            {item.label}
                                                        </span>
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
                                <Image
                                    src={avatarUrl}
                                    alt={fullName}
                                    width={32}
                                    height={32}
                                    unoptimized
                                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                                />
                            ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                                    {initials}
                                </span>
                            )}
                            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                                <p className="truncate text-sm font-semibold text-ink-900">
                                    {fullName}
                                </p>
                                <p className="truncate text-xs text-ink-400">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <form action={customerLogoutAction}>
                                    <SidebarMenuButton
                                        type="submit"
                                        tooltip="Log out"
                                        className="text-ink-500 hover:bg-error-50 hover:text-error-700"
                                    >
                                        <LogOut />
                                        <span>Log out</span>
                                    </SidebarMenuButton>
                                </form>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                </Sidebar>
                <SidebarInset>
                    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <SidebarTrigger />
                            <span className="text-sm font-medium text-ink-600">
                                {navItems.find(
                                    (item) =>
                                        item.href !== '/dashboard' &&
                                        pathname.startsWith(item.href),
                                )?.label || 'Dashboard'}
                            </span>
                        </div>
                        <NotificationBell initial={notifications} />
                    </header>
                    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ThemeScope.Provider>
    );
}
