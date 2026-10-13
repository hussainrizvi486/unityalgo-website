import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/utils/index";
import React from "react";
import { useThemeScope } from './theme-scope';

const Popover = PopoverPrimitive.Root;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className = "", align = "center", sideOffset = 8, ...props }, ref) => {
  const themeScope = useThemeScope();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-auto rounded border border-ink-200 bg-popover p-2 text-foreground shadow-md outline-none",
          // zoom-*, not scale-*: tailwindcss-animate only ships zoom-in/zoom-out,
          // so the previous scale-in-95/scale-out-95 were inert class names and
          // the popover appeared with no animation at all.
          "duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          // Grow from the edge nearest the trigger rather than the centre.
          "origin-[--radix-popover-content-transform-origin]",
          themeScope,
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

PopoverContent.displayName = PopoverPrimitive.Content.displayName;
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
