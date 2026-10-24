'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, ChevronsUpDown, LogOut, Moon, Sun, type LucideIcon } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useDashboardTheme } from '@/components/ui/dashboard-root';
import { AvatarInitials } from '@/components/admin/avatar-initials';
import { cn } from '@/utils';

export interface SidebarNavChild {
    title: string;
    href: string;
}

export interface SidebarNavItem {
    title: string;
    href: string;
    icon?: LucideIcon;
    /** Small count or label on the right, e.g. open tickets. */
    badge?: string | number;
    /** Match the path exactly instead of by prefix (use for a section's index page). */
    exact?: boolean;
    /** Sub-pages; the item becomes a collapsible group. */
    items?: SidebarNavChild[];
    /** Start expanded even when none of its sub-pages is the current page. */
    defaultOpen?: boolean;
}

export interface SidebarNavGroup {
    label?: string;
    items: SidebarNavItem[];
}

export interface SidebarBrand {
    name: string;
    /** Second line under the name, e.g. "Admin" or "Customer portal". */
    tagline?: string;
    href: string;
}

export interface SidebarUser {
    name: string;
    email: string;
    avatarUrl?: string | null;
}

export interface SidebarAccountLink {
    label: string;
    href: string;
    icon?: LucideIcon;
}

export interface AppSidebarProps {
    brand: SidebarBrand;
    groups: SidebarNavGroup[];
    user: SidebarUser;
    /** Links in the account menu, above "Log out". */
    accountLinks?: SidebarAccountLink[];
    /** Server action that ends the session. */
    logoutAction: (formData: FormData) => void | Promise<void>;
    variant?: 'sidebar' | 'floating' | 'inset';
}

const isCurrent = (pathname: string, item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

const isCurrentChild = (pathname: string, child: SidebarNavChild, siblings: SidebarNavChild[]) =>
    isCurrent(pathname, child)
    && !siblings.some((other) => other !== child && other.href.length > child.href.length && isCurrent(pathname, other));

export function AppSidebar({ brand, groups, user, accountLinks = [], logoutAction, variant = 'sidebar' }: AppSidebarProps) {
    const pathname = usePathname();
    return (
        <Sidebar collapsible="icon" variant={variant}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild tooltip={brand.name}>
                            <Link href={brand.href} className="group-data-[collapsible=icon]:justify-center">
                                <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent">
                                    <Image src="/logo.svg" alt="" width={28} height={28} className="size-6" priority />
                                </span>
                                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                                    <span className="truncate font-logo font-semibold">{brand.name}</span>
                                    {brand.tagline && <span className="truncate text-xs text-muted-foreground">{brand.tagline}</span>}
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="scrollbar-none">
                {groups.map((group, index) => (
                    <SidebarGroup key={group.label ?? index}>
                        {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => (
                                    <NavItem key={item.href} item={item} pathname={pathname} />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter>
                <AccountMenu user={user} links={accountLinks} logoutAction={logoutAction} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

function NavItem({ item, pathname }: { item: SidebarNavItem; pathname: string }) {
    const { state } = useSidebar();
    const active = isCurrent(pathname, item);
    const childActive = item.items?.some((child) => isCurrent(pathname, child)) ?? false;
    const [open, setOpen] = React.useState(active || childActive || Boolean(item.defaultOpen));

    if (!item.items?.length) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                    <Link href={item.href}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                    </Link>
                </SidebarMenuButton>
                {item.badge != null && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={active || childActive}
                tooltip={item.title}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                <ChevronRight className={cn('ml-auto transition-transform group-data-[collapsible=icon]:hidden', open && 'rotate-90')} />
            </SidebarMenuButton>
            {open && state !== 'collapsed' && (
                <SidebarMenuSub>
                    {item.items.map((child) => (
                        <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={isCurrentChild(pathname, child, item.items!)}>
                                <Link href={child.href}>
                                    <span>{child.title}</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    ))}
                </SidebarMenuSub>
            )}
        </SidebarMenuItem>
    );
}

function AccountMenu({
    user,
    links,
    logoutAction,
}: {
    user: SidebarUser;
    links: SidebarAccountLink[];
    logoutAction: (formData: FormData) => void | Promise<void>;
}) {
    const router = useRouter();
    const { isMobile } = useSidebar();
    const { dark, toggle } = useDashboardTheme();
    const logoutForm = React.useRef<HTMLFormElement>(null);

    const identity = (
        <>
            <Avatar user={user} />
            <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
        </>
    );

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu
                    side={isMobile ? 'top' : 'right'}
                    align="end"
                    className="w-64"
                    trigger={
                        <SidebarMenuButton size="lg" tooltip={user.name} className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span:nth-child(2)]:hidden">
                            {identity}
                            <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                        </SidebarMenuButton>
                    }
                >
                    <div className="flex items-center gap-2 px-2.5 py-2 text-sm">{identity}</div>
                    <DropdownMenuSeparator />
                    {links.length > 0 && <DropdownMenuLabel>Account</DropdownMenuLabel>}
                    {links.map((link) => (
                        <DropdownMenuItem key={link.href} icon={link.icon && <link.icon />} onSelect={() => router.push(link.href)}>
                            {link.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem icon={dark ? <Sun /> : <Moon />} onSelect={toggle}>
                        {dark ? 'Light theme' : 'Dark theme'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem tone="destructive" icon={<LogOut />} onSelect={() => logoutForm.current?.requestSubmit()}>
                        Log out
                    </DropdownMenuItem>
                </DropdownMenu>
                <form ref={logoutForm} action={logoutAction} hidden />
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function Avatar({ user }: { user: SidebarUser }) {
    if (user.avatarUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
        );
    }
    return <AvatarInitials name={user.name} className="size-8 rounded-lg" />;
}
