'use client';

import { usePathname } from 'next/navigation';
import {
    BarChart3,
    CreditCard,
    Headphones,
    Layers,
    Settings,
    AppWindow,
    Globe,
    Component,
} from 'lucide-react';
import { NotificationBell } from './notification-bell';
import type { listNotifications } from '@/lib/customer-notifications';
import { customerLogoutAction } from '@/app/customer/actions';
import { useAvatarUrl } from '@/lib/use-avatar';
import { DashboardRoot, ThemeToggle } from '@/components/ui/dashboard-root';
import { AppSidebar, type SidebarNavGroup } from '@/components/ui/app-sidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const pages = [
    { title: 'Dashboard', description: 'Your account and sites at a glance', href: '/dashboard', icon: BarChart3, exact: true },
    { title: 'Sites', description: 'Create, manage and monitor your AlgoSuite sites', href: '/dashboard/sites', icon: Globe },
    { title: 'App Store', description: 'Browse and install marketplace apps onto your sites', href: '/dashboard/app-store', icon: AppWindow },
    { title: 'Plans', description: 'Compare plans and choose what fits', href: '/dashboard/plans', icon: Layers },
    { title: 'Subscription', description: 'Your plan, billing and invoices', href: '/dashboard/subscription', icon: CreditCard },
    { title: 'Support', description: 'Ask for help and follow your tickets', href: '/dashboard/support', icon: Headphones },
    { title: 'Settings', description: 'Profile, password and addresses', href: '/dashboard/settings', icon: Settings },
    { title: 'Components', description: 'Live reference for the portal design system', href: '/dashboard/components', icon: Component },
];

const groups: SidebarNavGroup[] = [
    { label: 'Workspace', items: pages.slice(0, 3) },
    { label: 'Account', items: pages.slice(3) },
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
    initialDark,
}: {
    children: React.ReactNode;
    user: CustomerShellUser;
    notifications: Awaited<ReturnType<typeof listNotifications>>;
    initialDark: boolean;
}) {
    const pathname = usePathname();
    const avatarUrl = useAvatarUrl();
    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
    const current =
        pages.find((page) => (page.exact ? pathname === page.href : pathname.startsWith(page.href) && page.href !== '/dashboard'))
        ?? pages[0];

    return (
        <DashboardRoot initialDark={initialDark}>
            <AppSidebar
                brand={{ name: 'UnityAlgo', tagline: 'Customer portal', href: '/dashboard' }}
                groups={groups}
                user={{ name: fullName, email: user.email, avatarUrl }}
                accountLinks={[
                    { label: 'Profile', href: '/dashboard/settings/profile', icon: Settings },
                    { label: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
                    { label: 'Support', href: '/dashboard/support', icon: Headphones },
                ]}
                logoutAction={customerLogoutAction}
            />
            <SidebarInset>
                <header className="portal-topbar sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-card">
                    <div className="flex min-w-0 items-center gap-3">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="h-8" />
                        <div className="min-w-0 leading-tight">
                            <p className="truncate font-semibold text-foreground">{current.title}</p>
                            <p className="truncate portal-text-caption text-muted-foreground">{current.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeToggle />
                        <NotificationBell initial={notifications} />
                    </div>
                </header>
                <main className="portal-content">{children}</main>
            </SidebarInset>
        </DashboardRoot>
    );
}
