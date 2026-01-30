import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Increased size: h-7 w-12 (28x48px) for better touch targets
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      // Smooth transitions
      "transition-all duration-200 ease-in-out",
      // States
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      // Focus states
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Disabled state
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Increased thumb size: h-6 w-6 (24x24px)
        "pointer-events-none block h-6 w-6 rounded-full bg-background",
        // Enhanced shadow for depth
        "shadow-md",
        // Smooth transition
        "transition-transform duration-200 ease-in-out",
        // Translate distance adjusted for new width
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
