import * as React from "react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Custom Switch component - v4
 *
 * Built without Radix primitives to match ThemeToggle exactly.
 * Uses absolute positioning and minWidth/minHeight to prevent flex deformation.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, defaultChecked = false, onCheckedChange, disabled, className, ...props }, ref) => {
    // Support both controlled and uncontrolled modes
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const isChecked = checked !== undefined ? checked : internalChecked;

    const handleClick = () => {
      if (disabled) return;
      void hapticTap();
      const newValue = !isChecked;
      if (checked === undefined) {
        setInternalChecked(newValue);
      }
      onCheckedChange?.(newValue);
    };

    // Handle keyboard accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? 'checked' : 'unchecked'}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // 52px visual width with a 44px accessible touch target
          "relative flex-shrink-0 rounded-full motion-safe:transition-colors motion-safe:duration-300 active:scale-[0.97]",
          "w-[52px] h-[44px] min-w-[52px] min-h-[44px]",
          // Colors - semantic theme colors
          isChecked ? "bg-primary" : "bg-muted-foreground/40",
          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Disabled state
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "cursor-pointer",
          className,
        )}
        {...props}
      >
        {/* Thumb - absolute positioning like ThemeToggle, spring-like cubic-bezier */}
        <div
          className={cn(
            // Thumb stays visually compact while the switch keeps a 44px tap target
            "absolute top-[11px] w-[22px] h-[22px] rounded-full",
            // Background and shadow
            "bg-background shadow-sm",
            // Base position left-[3px]; checked slides 24px right via translateX (GPU-only)
            "left-[3px]",
          )}
          style={{
            transform: isChecked ? 'translateX(24px)' : 'translateX(0)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
