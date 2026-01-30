import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
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
          // Exact ThemeToggle dimensions: 52×28px
          "relative flex-shrink-0 rounded-full transition-all duration-300",
          "w-[52px] h-[28px]",
          // Colors - match ThemeToggle dark mode
          isChecked ? "bg-primary" : "bg-slate-600",
          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Disabled state
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "cursor-pointer",
          className,
        )}
        // Critical: minWidth/minHeight prevents flex container compression
        style={{ minWidth: '52px', minHeight: '28px' }}
        {...props}
      >
        {/* Thumb - absolute positioning like ThemeToggle */}
        <div
          className={cn(
            // Exact thumb size: 22×22px positioned 3px from top
            "absolute top-[3px] w-[22px] h-[22px] rounded-full transition-all duration-300",
            // Background and shadow
            "bg-background shadow-sm",
            // Position: 3px (unchecked) → 27px (checked)
            isChecked ? "left-[27px]" : "left-[3px]",
          )}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
