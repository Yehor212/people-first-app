import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Match ThemeToggle proportions exactly: 52×28px
      "peer inline-flex w-[52px] h-[28px] shrink-0 cursor-pointer items-center rounded-full",
      // Smooth transitions like ThemeToggle
      "transition-all duration-300",
      // States - match dark theme colors for consistency
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-slate-600",
      // Focus states
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Disabled state
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Match ThemeToggle thumb exactly: 22×22px with 3px padding
        "pointer-events-none block w-[22px] h-[22px] rounded-full bg-background",
        // Subtle shadow like ThemeToggle (not shadow-lg!)
        "shadow-sm",
        // Smooth transition like ThemeToggle
        "transition-all duration-300",
        // Translate: 24px travel (3px → 27px position)
        "data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0.5",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
