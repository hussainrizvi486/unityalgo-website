'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Activity,
    Inbox, AtSign, Boxes, Coins, Database, FileText, Layers, LogOut, Mail,
    MessageSquareText, PackagePlus, Server, Users,
} from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import Image from 'next/image';
import { logoutAction } from '@/app/admin/actions';

/**
 * The admin panel's navigation.
 *
 * Built on the shadcn Sidebar primitives rather than a hand-rolled `<aside>`,
 * which is what gives it the collapse-to-icons state, the mobile drawer, the
 * keyboard shortcut and the rail — all behaviour the previous fixed-width
 * version did not have and would have had to reimplement.
 *
 * `variant="floating"` is the split layout: the nav is a card on the page's
 * ground rather than a panel welded to the viewport edge.
 */

// Grouped so the infrastructure sections (backed by the controller API) read
// as a distinct area from the content/commerce ones backed by Prisma.
const navGroups = [
    {
        label: 'Platform',
        items: [
            { name: 'Blogs', href: '/admin/blogs', icon: FileText },
            { name: 'Plans', href: '/admin/plans', icon: Layers },
            { name: 'Add-ons', href: '/admin/addons', icon: PackagePlus },
            { name: 'Applications', href: '/admin/apps', icon: Boxes },
            { name: 'Currencies', href: '/admin/currencies', icon: Coins },
            { name: 'Tickets', href: '/admin/tickets', icon: MessageSquareText },
            { name: 'Users', href: '/admin/users', icon: Users },
            { name: 'Leads', href: '/admin/leads', icon: Inbox },
            { name: 'Contacts', href: '/admin/contacts', icon: Mail },
            { name: 'Email accounts', href: '/admin/email-accounts', icon: AtSign },
        ],
    },
    {
        label: 'Infrastructure',
        items: [
            { name: 'Servers', href: '/admin/servers', icon: Server },
            { name: 'Databases', href: '/admin/databases', icon: Database },
            { name: 'Tenants', href: '/admin/tenants', icon: Boxes },
            { name: 'Activity Log', href: '/admin/logs', icon: Activity },
        ],
    },
];

/** Flattened for the topbar's jump-to search, so both read one list. */
export const adminNavItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.label })),
);

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        // <Sidebar variant='floating' collapsible="icon" className="p-3 pr-0">
        <Sidebar collapsible="icon" className="">
            <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
                {/* Not the marketing <Logo/>: that component contains its own
                    <Link href="/">, so nesting it here produced an <a> inside
                    an <a> and a hydration error — and it is sized for a page
                    header, not a 256px rail. */}
                <Link
                    href="/admin"
                    className="flex items-center gap-2.5 overflow-hidden rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <Image src="/logo.svg" alt="" width={28} height={28} className="size-7 shrink-0" priority />
                    {/* Both hidden when collapsed to icons, where only the mark fits. */}
                    <span className="truncate font-logo text-[15px] font-bold leading-none text-ink-900 group-data-[collapsible=icon]:hidden">
                        UnityAlgo
                    </span>
                    <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500 group-data-[collapsible=icon]:hidden">
                        Admin
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="gap-0 px-1 py-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
                {navGroups.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                            {group.label}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            // startsWith, so a detail or edit page keeps its
                                            // section lit rather than losing the highlight.
                                            isActive={pathname.startsWith(item.href)}
                                            tooltip={item.name}
                                            className="hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 active:text-ink-900 data-[active=true]:bg-ink-200 data-[active=true]:text-ink-900"
                                        >
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.name}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <form action={logoutAction}>
                            <SidebarMenuButton
                                type="submit"
                                tooltip="Log out"
                                className="w-full text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 active:text-ink-900"
                            >
                                <LogOut />
                                <span>Log out</span>
                            </SidebarMenuButton>
                        </form>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
