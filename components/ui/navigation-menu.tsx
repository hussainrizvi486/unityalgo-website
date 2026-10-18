'use client';

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

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
    'group inline-flex h-9 w-max items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors ' +
    'hover:bg-secondary focus-visible:ring-ring/50 focus-visible:ring-3 ' +
    'data-[state=open]:bg-secondary disabled:pointer-events-none disabled:opacity-50',
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
                className="relative top-px size-3.5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180"
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
                    'origin-top-center relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden',
                    'rounded-xl border border-border bg-popover text-popover-foreground shadow-lg',
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
                'hover:bg-muted focus-visible:ring-ring/50 focus-visible:ring-3',
                'data-[active=true]:bg-muted data-[active=true]:text-foreground',
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
