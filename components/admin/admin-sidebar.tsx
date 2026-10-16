'use client';

import {
    Activity, Inbox, AtSign, Boxes, Globe, Coins, Database, FileText, Layers, Mail,
    MessageSquareText, PackagePlus, Server, Users,
} from 'lucide-react';
import { AppSidebar, type SidebarNavGroup, type SidebarUser } from '@/components/ui/app-sidebar';
import { logoutAction } from '@/app/admin/actions';

/**
 * The admin panel's navigation: data for the shared AppSidebar (components/ui/app-sidebar.tsx), which owns the
 * layout, collapse behaviour, active states and account menu for the customer portal as well.
 */

// Grouped so the infrastructure sections (backed by the controller API) read as a distinct area from the
// content and commerce ones.
const navGroups: SidebarNavGroup[] = [
    {
        label: 'Platform',
        items: [
            { title: 'Blogs', href: '/admin/blogs', icon: FileText },
            { title: 'Plans', href: '/admin/plans', icon: Layers },
            { title: 'Add-ons', href: '/admin/addons', icon: PackagePlus },
            {
                title: 'App Store',
                href: '/admin/apps',
                icon: Boxes,
                items: [
                    { title: 'Applications', href: '/admin/apps' },
                    { title: 'GitHub account', href: '/admin/apps/github' },
                ],
            },
            { title: 'Currencies', href: '/admin/currencies', icon: Coins },
            { title: 'Tickets', href: '/admin/tickets', icon: MessageSquareText },
            { title: 'Users', href: '/admin/users', icon: Users },
            { title: 'Leads', href: '/admin/leads', icon: Inbox },
            { title: 'Contacts', href: '/admin/contacts', icon: Mail },
            { title: 'Email accounts', href: '/admin/email-accounts', icon: AtSign },
        ],
    },
    {
        label: 'Infrastructure',
        items: [
            { title: 'Servers', href: '/admin/servers', icon: Server },
            { title: 'Databases', href: '/admin/databases', icon: Database },
            { title: 'Tenants', href: '/admin/tenants', icon: Boxes },
            { title: 'Sites', href: '/admin/sites', icon: Globe },
            { title: 'Activity Log', href: '/admin/logs', icon: Activity },
        ],
    },
];

/** Flattened for the topbar's jump-to search, so both read one list. */
export const adminNavItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({ name: item.title, href: item.href, icon: item.icon!, group: group.label ?? '' })),
);

export function AdminSidebar({ user }: { user: SidebarUser }) {
    return (
        <AppSidebar
            brand={{ name: 'UnityAlgo', tagline: 'Admin panel', href: '/admin' }}
            groups={navGroups}
            user={user}
            logoutAction={logoutAction}
        />
    );
}
