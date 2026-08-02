'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Users, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { cn } from '@/utils';
import { logoutAction } from '@/app/admin/actions';

const navItems = [
    { name: 'Blogs', href: '/admin/blogs', icon: FileText },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Contacts', href: '/admin/contacts', icon: Mail },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 shrink-0 bg-white border-r border-ink-100 min-h-screen flex flex-col">
            <div className="px-6 py-6 border-b border-ink-100 flex items-center gap-2">
                <Logo className="h-8" />
                <span className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Admin</span>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1">
                {navItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                active ? 'bg-accent text-brand' : 'text-ink-600 hover:bg-ink-50'
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-3 py-6 border-t border-ink-100">
                <form action={logoutAction}>
                    <Button type="submit" variant="outline" className="w-full rounded-lg justify-start gap-3">
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </Button>
                </form>
            </div>
        </aside>
    );
}
