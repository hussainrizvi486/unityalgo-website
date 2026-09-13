import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-ink-100 text-ink-600",
        success: "bg-success-50 text-success-600",
        info: "bg-info-50 text-info-600",
        warning: "bg-warning-50 text-warning-700",
        error: "bg-error-50 text-error-700",
        brand: "bg-accent text-brand",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant,
  dot = true,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
