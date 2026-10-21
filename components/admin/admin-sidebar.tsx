'use client';

import {
    Activity, Inbox, AtSign, Boxes, Globe, Coins, CreditCard, Database, FileText, Layers, Mail, MailOpen,
    MessageSquareText, Package, PackagePlus, Server, Users, Workflow,
} from 'lucide-react';
import { AppSidebar, type SidebarNavGroup, type SidebarUser } from '@/components/ui/app-sidebar';
import { logoutAction } from '@/app/admin/actions';

const navGroups: SidebarNavGroup[] = [
    {
        label: 'Platform',
        items: [
            { title: 'Blogs', href: '/admin/blogs', icon: FileText },
            { title: 'Products', href: '/admin/products', icon: Package },
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
            { title: 'Payments', href: '/admin/payments', icon: CreditCard },
            { title: 'Currencies', href: '/admin/currencies', icon: Coins },
            { title: 'Tickets', href: '/admin/tickets', icon: MessageSquareText },
            { title: 'Users', href: '/admin/users', icon: Users },
            { title: 'Leads', href: '/admin/leads', icon: Inbox },
            { title: 'Contacts', href: '/admin/contacts', icon: Mail },
            { title: 'Email accounts', href: '/admin/email-accounts', icon: AtSign },
            { title: 'Email templates', href: '/admin/email-templates', icon: MailOpen },
        ],
    },
    {
        label: 'Infrastructure',
        items: [
            { title: 'Servers', href: '/admin/servers', icon: Server },
            { title: 'Databases', href: '/admin/databases', icon: Database },
            { title: 'Tenants', href: '/admin/tenants', icon: Boxes },
            { title: 'Sites', href: '/admin/sites', icon: Globe },
            { title: 'Queue & workers', href: '/admin/queue', icon: Workflow },
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
