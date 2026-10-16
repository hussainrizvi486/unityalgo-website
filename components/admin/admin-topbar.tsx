'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command, Search } from 'lucide-react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/dashboard-root';
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';
import { adminNavItems } from '@/components/admin/admin-sidebar';
import { cn } from '@/utils';

/**
 * The admin panel's top bar: collapse control, breadcrumbs, and jump-to search.
 *
 * The search is a navigator, not a data search — it filters the admin's own
 * sections so ⌘K takes you to Tenants without reaching for the sidebar. It is
 * built from a plain input and a listbox rather than pulling in `cmdk`: the
 * whole dataset is eleven static entries, and a dependency for that would cost
 * more than it carries.
 *
 * The light / dark switch switches the `.dashboard` token scope, which the
 * customer portal shares.
 */

export function AdminTopbar() {
    const router = useRouter();
    const { isMobile } = useSidebar();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [cursor, setCursor] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const boxRef = React.useRef<HTMLDivElement>(null);

    const matches = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return adminNavItems;
        return adminNavItems.filter(
            (item) =>
                item.name.toLowerCase().includes(needle)
                || item.group.toLowerCase().includes(needle),
        );
    }, [query]);

    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen(true);
                // Focus after the input exists, not in the same tick.
                requestAnimationFrame(() => inputRef.current?.select());
            }
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Close on a click anywhere else, which a bare listbox does not do for free.
    React.useEffect(() => {
        if (!open) return;
        const onDown = (event: PointerEvent) => {
            if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
        };
        window.addEventListener('pointerdown', onDown);
        return () => window.removeEventListener('pointerdown', onDown);
    }, [open]);

    function go(href: string) {
        setOpen(false);
        setQuery('');
        router.push(href);
    }

    function onInputKey(event: React.KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, matches.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
        } else if (event.key === 'Enter' && matches[cursor]) {
            event.preventDefault();
            go(matches[cursor].href);
        }
    }

    return (
        <header className="portal-topbar sticky top-0 flex shrink-0 items-center gap-3 border-b border-border/60 bg-card/85 backdrop-blur-sm">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />

            <div className="min-w-0 flex-1">
                <AdminBreadcrumbs />
            </div>

            <div ref={boxRef} className="relative">
                <button
                    type="button"
                    onClick={() => {
                        setOpen(true);
                        requestAnimationFrame(() => inputRef.current?.select());
                    }}
                    className={cn(
                        'flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-3 portal-text-body text-muted-foreground',
                        'transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        open && 'invisible',
                    )}
                >
                    <Search className="size-4" />
                    <span className="hidden sm:inline portal-text-caption">Jump to…</span>
                    {!isMobile ? (
                        <kbd className="flex items-center gap-0.5 ml-6 rounded border border-border bg-card px-1 font-mono portal-text-caption text-muted-foreground">
                            <Command className='size-2.5'/>
                            <div>K</div>
                        </kbd>
                    ) : null}
                </button>

                {open ? (
                    <div className="portal-menu-layer absolute right-0 top-0 w-72 overflow-hidden rounded-md border border-border bg-card shadow-lg">
                        <div className="flex items-center gap-2 border-b border-border/60 px-3">
                            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                                onKeyDown={onInputKey}
                                placeholder="Jump to a section…"
                                aria-label="Jump to a section"
                                className="h-9 w-full bg-transparent portal-text-body text-foreground outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <ul role="listbox" className="max-h-72 overflow-auto py-1">
                            {matches.length === 0 ? (
                                <li className="px-3 py-6 text-center portal-text-caption text-muted-foreground">
                                    Nothing matches &ldquo;{query}&rdquo;
                                </li>
                            ) : matches.map((item, i) => (
                                <li key={item.href}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={i === cursor}
                                        onMouseEnter={() => setCursor(i)}
                                        onClick={() => go(item.href)}
                                        className={cn(
                                            'flex w-full items-center gap-2.5 px-3 py-2 text-left portal-text-body',
                                            // Keyboard cursor: a neutral highlight, so it
                                            // does not read as an alert on every keystroke.
                                            i === cursor ? 'bg-secondary text-foreground' : 'text-foreground/80',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                                        <span className="truncate">{item.name}</span>
                                        <span className="ml-auto shrink-0 portal-text-micro uppercase tracking-wide text-muted-foreground">
                                            {item.group}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
            <ThemeToggle />
        </header>
    );
}
