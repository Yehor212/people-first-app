import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Standard iOS-like proportions: h-6 w-11 (24×44px) - proper padding for thumb
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
      // Smooth transitions
      "transition-colors duration-200",
      // States - clear color distinction
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
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
        // Thumb: 20×20px with 2px padding inside 24×44 track
        "pointer-events-none block h-5 w-5 rounded-full bg-background",
        // Enhanced shadow for depth and clear definition
        "shadow-lg",
        // Smooth transition
        "transition-transform duration-200",
        // Translate: full travel from left to right edge
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
