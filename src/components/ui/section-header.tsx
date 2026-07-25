import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type GradientType = "primary" | "warm" | "calm" | "sunset";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconGradient?: GradientType;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "default" | "lg";
}

const iconColorMap: Record<GradientType, string> = {
  primary: "text-primary",
  warm: "text-accent",
  calm: "text-blue-500",
  sunset: "text-rose-500",
};

const sizeConfig = {
  sm: {
    wrapper: "gap-2 mb-3",
    icon: "w-4 h-4",
    title: "text-base font-semibold",
    subtitle: "text-xs",
  },
  default: {
    wrapper: "gap-2.5 mb-4",
    icon: "w-5 h-5",
    title: "text-lg font-semibold",
    subtitle: "text-sm",
  },
  lg: {
    wrapper: "gap-3 mb-5",
    icon: "w-6 h-6",
    title: "text-xl font-bold",
    subtitle: "text-sm",
  },
};

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconGradient = "primary",
  action,
  className,
  size = "default",
}: SectionHeaderProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-start min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]",
        config.wrapper,
        className
      )}
    >
      {Icon && (
        <Icon className={cn(config.icon, iconColorMap[iconGradient], "flex-shrink-0")} />
      )}

      <div
        className={cn(
          "min-w-0",
          Icon
            ? "col-start-2"
            : "col-span-2 min-[420px]:col-start-1 min-[420px]:col-end-3"
        )}
      >
        <h3 className={cn(config.title, "whitespace-normal break-words text-foreground")}>
          {title}
        </h3>
        {subtitle && (
          <p
            className={cn(
              config.subtitle,
              "mt-0.5 whitespace-normal break-words text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="col-span-2 min-w-0 min-[420px]:col-span-1 min-[420px]:col-start-3 min-[420px]:justify-self-end">
          {action}
        </div>
      )}
    </div>
  );
}

export type { SectionHeaderProps, GradientType };
