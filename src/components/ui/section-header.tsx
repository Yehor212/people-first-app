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
    <div className={cn("flex items-center", config.wrapper, className)}>
      {Icon && (
        <Icon className={cn(config.icon, iconColorMap[iconGradient], "flex-shrink-0")} />
      )}

      <div className="flex-1 min-w-0">
        <h3 className={cn(config.title, "text-foreground truncate")}>{title}</h3>
        {subtitle && (
          <p className={cn(config.subtitle, "text-muted-foreground truncate mt-0.5")}>
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export type { SectionHeaderProps, GradientType };
