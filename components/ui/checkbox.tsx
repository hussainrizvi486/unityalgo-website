import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/utils";

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className = "", ...props }, ref) => {
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            className={cn(
                "h-4 w-4 shrink-0 rounded overflow-hidden border border-gray-900 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gray-900 data-[state=checked]:text-white flex items-center justify-center transition-all duration-200 ease-in-out cursor-pointer",
                className
            )
            }
            {...props}
        >
            <CheckboxPrimitive.Indicator >
                <svg focusable="false"
                    aria-hidden="true" viewBox="0 0 24 24" data-testid="CheckIcon" className="size-4 text-current fill-current">
                    <path d="M9 16.17 5.53 12.7a.9959.9959 0 0 0-1.41 0c-.39.39-.39 1.02 0 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71c.39-.39.39-1.02 0-1.41a.9959.9959 0 0 0-1.41 0L9 16.17z"></path>
                </svg>
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root >
    )
})

Checkbox.displayName = CheckboxPrimitive.Root.displayName
export { Checkbox };