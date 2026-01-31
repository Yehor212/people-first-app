import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        // Status variants
        success: "border-transparent bg-[hsl(var(--mood-good))] text-white hover:bg-[hsl(var(--mood-good))]/80",
        warning: "border-transparent bg-[hsl(var(--mood-okay))] text-white hover:bg-[hsl(var(--mood-okay))]/80",
        info: "border-transparent bg-blue-500 text-white dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700",
        // Soft variants
        soft: "border-transparent bg-primary/15 text-primary hover:bg-primary/25",
        "soft-success": "border-transparent bg-[hsl(var(--mood-good))]/15 text-[hsl(var(--mood-good))] hover:bg-[hsl(var(--mood-good))]/25",
        "soft-warning": "border-transparent bg-[hsl(var(--mood-okay))]/15 text-[hsl(var(--mood-okay))] hover:bg-[hsl(var(--mood-okay))]/25",
        "soft-destructive": "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[11px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
