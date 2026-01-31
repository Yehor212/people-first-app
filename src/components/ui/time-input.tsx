import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimeInputProps {
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  icon?: string; // emoji prefix (e.g., "🌅")
  label?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function TimeInput({
  value,
  onChange,
  icon,
  label,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: TimeInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className="text-sm text-muted-foreground min-w-fit">{label}</span>
      )}

      <div className="relative flex items-center">
        {/* Emoji/Icon prefix */}
        {icon && (
          <span className="absolute left-3 text-base pointer-events-none z-10" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Styled time input */}
        <input
          type="time"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={cn(
            "appearance-none bg-secondary/80 rounded-xl text-foreground font-medium",
            "h-11 px-4 py-2 text-sm",
            "border-2 border-transparent",
            "focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20",
            "hover:bg-secondary transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            // Custom styling for the time input
            "[&::-webkit-calendar-picker-indicator]:opacity-0",
            "[&::-webkit-calendar-picker-indicator]:absolute",
            "[&::-webkit-calendar-picker-indicator]:right-0",
            "[&::-webkit-calendar-picker-indicator]:w-full",
            "[&::-webkit-calendar-picker-indicator]:h-full",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
            icon ? "pl-10" : "pl-4",
            "pr-10" // Space for clock icon
          )}
        />

        {/* Clock icon on the right */}
        <Clock
          className="absolute right-3 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// Compact variant for settings with inline label
interface TimeInputInlineProps extends Omit<TimeInputProps, 'label'> {
  label: string;
}

export function TimeInputInline({
  value,
  onChange,
  icon,
  label,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: TimeInputInlineProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 p-3 bg-secondary/50 rounded-xl",
      "hover:bg-secondary/70 transition-colors",
      disabled && "opacity-50",
      className
    )}>
      {/* Label with optional emoji */}
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-lg flex-shrink-0" aria-hidden="true">{icon}</span>}
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
      </div>

      {/* Time input */}
      <div className="relative flex-shrink-0">
        <input
          type="time"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={cn(
            "appearance-none bg-background rounded-lg text-foreground font-semibold text-center",
            "h-9 w-24 px-2 text-sm",
            "border border-border",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            "transition-all duration-150",
            "disabled:cursor-not-allowed",
            "[&::-webkit-calendar-picker-indicator]:opacity-0",
            "[&::-webkit-calendar-picker-indicator]:absolute",
            "[&::-webkit-calendar-picker-indicator]:inset-0",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          )}
        />
      </div>
    </div>
  );
}

export type { TimeInputProps, TimeInputInlineProps };
