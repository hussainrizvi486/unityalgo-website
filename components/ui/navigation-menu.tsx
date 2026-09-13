'use client';

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

/**
 * Radix navigation menu, themed to the ink palette.
 *
 * Replaces the pair of hand-rolled hover dropdowns the header used to carry.
 * Those opened on `onMouseEnter` alone, which meant they were unreachable by
 * keyboard and invisible to screen readers. Radix gives roving focus, Escape
 * to close, an intent-aware "safe triangle" so a diagonal cursor path to the
 * panel does not dismiss it, and a single shared viewport that resizes between
 * panels — the movement that makes this pattern read as polished.
 */

function NavigationMenu({
    className,
    children,
    viewport = true,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root> & { viewport?: boolean }) {
    return (
        <NavigationMenuPrimitive.Root
            data-slot="navigation-menu"
            data-viewport={viewport}
            className={cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center', className)}
            {...props}
        >
            {children}
            {viewport && <NavigationMenuViewport />}
        </NavigationMenuPrimitive.Root>
    );
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
    return (
        <NavigationMenuPrimitive.List
            data-slot="navigation-menu-list"
            className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
            {...props}
        />
    );
}

function NavigationMenuItem({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
    return (
        <NavigationMenuPrimitive.Item
            data-slot="navigation-menu-item"
            className={cn('relative', className)}
            {...props}
        />
    );
}

const navigationMenuTriggerStyle = cva(
    'group inline-flex h-9 w-max items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-ink-900 outline-none transition-colors ' +
    'hover:bg-ink-100 focus-visible:ring-ring/50 focus-visible:ring-[3px] ' +
    'data-[state=open]:bg-ink-100 disabled:pointer-events-none disabled:opacity-50',
);

function NavigationMenuTrigger({
    className,
    children,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
    return (
        <NavigationMenuPrimitive.Trigger
            data-slot="navigation-menu-trigger"
            className={cn(navigationMenuTriggerStyle(), className)}
            {...props}
        >
            {children}
            <ChevronDown
                className="relative top-px size-3.5 text-ink-400 transition-transform duration-300 group-data-[state=open]:rotate-180"
                aria-hidden="true"
            />
        </NavigationMenuPrimitive.Trigger>
    );
}

function NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
    return (
        <NavigationMenuPrimitive.Content
            data-slot="navigation-menu-content"
            className={cn(
                // Panels slide in from whichever side the previous panel was on,
                // so moving between triggers reads as one surface travelling
                // rather than two panels swapping.
                'top-0 left-0 w-full p-1 pr-2.5 md:absolute md:w-auto',
                'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out',
                'data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out',
                'data-[motion=from-end]:slide-in-from-right-40 data-[motion=from-start]:slide-in-from-left-40',
                'data-[motion=to-end]:slide-out-to-right-40 data-[motion=to-start]:slide-out-to-left-40',
                'duration-200 ease-out',
                className,
            )}
            {...props}
        />
    );
}

function NavigationMenuViewport({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
    return (
        <div className="absolute top-full left-0 isolate z-50 flex justify-center">
            <NavigationMenuPrimitive.Viewport
                data-slot="navigation-menu-viewport"
                className={cn(
                    // The viewport animates its own width/height between panels
                    // via the CSS variables Radix sets, which is the morph that
                    // makes the menu feel like one object.
                    'origin-top-center relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden',
                    'rounded-xl border border-ink-200 bg-popover text-popover-foreground shadow-lg',
                    'transition-[width,height] duration-300 ease-out',
                    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                    'md:w-[var(--radix-navigation-menu-viewport-width)]',
                    className,
                )}
                {...props}
            />
        </div>
    );
}

function NavigationMenuLink({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
    return (
        <NavigationMenuPrimitive.Link
            data-slot="navigation-menu-link"
            className={cn(
                'flex flex-col gap-1 rounded-md p-2 text-sm outline-none transition-colors',
                'hover:bg-ink-50 focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                'data-[active=true]:bg-ink-50 data-[active=true]:text-ink-900',
                className,
            )}
            {...props}
        />
    );
}

export {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuTrigger,
    NavigationMenuContent,
    NavigationMenuViewport,
    NavigationMenuLink,
    navigationMenuTriggerStyle,
};
