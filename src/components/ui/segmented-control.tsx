import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default" | "lg";
  fullWidth?: boolean;
  className?: string;
  "aria-label"?: string;
}

const sizeConfig = {
  sm: {
    container: "p-1 rounded-xl",
    button: "h-auto min-h-[44px] px-3 py-2 text-xs rounded-lg",
    icon: "w-3.5 h-3.5",
  },
  default: {
    container: "p-1 rounded-xl",
    button: "h-auto min-h-[44px] px-4 py-2 text-sm rounded-lg",
    icon: "w-4 h-4",
  },
  lg: {
    container: "p-1.5 rounded-2xl",
    button: "h-auto min-h-[44px] px-5 py-2 text-sm rounded-xl",
    icon: "w-4 h-4",
  },
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  fullWidth = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const config = sizeConfig[size];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-grid grid-cols-1 items-stretch max-w-full bg-secondary/80 backdrop-blur-sm shadow-zen-xs min-[420px]:grid-flow-col min-[420px]:auto-cols-fr",
        config.container,
        fullWidth && "w-full",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={cn(
              "relative flex min-w-0 w-full items-center justify-center gap-1.5 font-medium leading-tight motion-safe:transition-all btn-press",
              config.button,
              isSelected
                ? "bg-background text-foreground shadow-zen-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon && (
              <span className={cn(config.icon, "flex-shrink-0")}>
                {option.icon}
              </span>
            )}
            <span className="min-w-0 whitespace-normal break-words text-center">
              {option.label}
            </span>
            {isSelected && (
              <div className="absolute inset-0 ring-2 ring-primary/20 rounded-[inherit] pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export type { SegmentedControlProps, SegmentedControlOption };
