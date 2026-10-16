'use client';

import * as React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/utils';

/**
 * The small action menu behind a "…" or an account button.
 *
 * Built on the Popover already in the project rather than pulling in
 * @radix-ui/react-dropdown-menu: a menu is a popover plus roving arrow-key
 * focus and the right roles, and that is cheaper to own than another
 * dependency shipping its own copy of the same primitives.
 *
 * Radix's version would give us typeahead and submenus. Neither is needed by
 * any menu in this app; if one ever is, swap the internals here and the call
 * sites keep working.
 */

const MenuContext = React.createContext<{ close: () => void }>({ close: () => {} });

export function DropdownMenu({
    trigger,
    children,
    align = 'end',
    side = 'bottom',
    className,
}: {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement>(null);

    const items = () =>
        Array.from(
            contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])') ?? [],
        );

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const all = items();
        if (all.length === 0) return;
        const current = all.indexOf(document.activeElement as HTMLElement);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // -1 (focus is on the container) steps to the first item going down and
        // the last going up, which is what both directions should open on.
        const next = current === -1 ? (step === 1 ? 0 : all.length - 1) : (current + step + all.length) % all.length;
        all[next]?.focus();
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                ref={contentRef}
                align={align}
                side={side}
                sideOffset={6}
                role="menu"
                onKeyDown={handleKeyDown}
                className={cn('min-w-52 p-1', className)}
            >
                <MenuContext.Provider value={{ close: () => setOpen(false) }}>
                    {children}
                </MenuContext.Provider>
            </PopoverContent>
        </Popover>
    );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {children}
        </div>
    );
}

export function DropdownMenuSeparator() {
    return <div role="separator" className="-mx-1 my-1 h-px bg-secondary" />;
}

export function DropdownMenuItem({
    children,
    icon,
    shortcut,
    tone = 'default',
    disabled,
    onSelect,
    className,
}: {
    children: React.ReactNode;
    icon?: React.ReactNode;
    /** Right-aligned hint, e.g. ⌘K. Decorative — this does not bind the key. */
    shortcut?: string;
    tone?: 'default' | 'destructive';
    disabled?: boolean;
    onSelect?: () => void;
    className?: string;
}) {
    const { close } = React.useContext(MenuContext);
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            // The arrow-key walker skips anything marked disabled, and a plain
            // attribute keeps that check out of React state.
            data-disabled={disabled ? '' : undefined}
            onClick={() => { onSelect?.(); close(); }}
            className={cn(
                'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm outline-none',
                'focus-visible:bg-secondary hover:bg-secondary',
                tone === 'destructive' ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10' : 'text-foreground/80',
                disabled && 'pointer-events-none opacity-50',
                className,
            )}
        >
            {icon && <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {shortcut && <span className="shrink-0 font-mono text-xs text-muted-foreground">{shortcut}</span>}
        </button>
    );
}
