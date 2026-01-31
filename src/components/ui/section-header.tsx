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

const gradientMap: Record<GradientType, string> = {
  primary: "zen-gradient",
  warm: "zen-gradient-warm",
  calm: "zen-gradient-calm",
  sunset: "zen-gradient-sunset",
};

const shadowMap: Record<GradientType, string> = {
  primary: "shadow-zen-soft",
  warm: "shadow-[0_4px_20px_-4px_hsl(28_75%_65%/0.25)]",
  calm: "shadow-[0_4px_20px_-4px_hsl(200_40%_50%/0.25)]",
  sunset: "shadow-[0_4px_20px_-4px_hsl(350_60%_65%/0.25)]",
};

const sizeConfig = {
  sm: {
    wrapper: "gap-2.5 mb-3",
    iconContainer: "p-2 rounded-xl",
    icon: "w-4 h-4",
    title: "text-base font-semibold",
    subtitle: "text-xs",
  },
  default: {
    wrapper: "gap-3 mb-4",
    iconContainer: "p-2.5 rounded-xl",
    icon: "w-5 h-5",
    title: "text-lg font-bold",
    subtitle: "text-sm",
  },
  lg: {
    wrapper: "gap-4 mb-5",
    iconContainer: "p-3 rounded-2xl",
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
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              config.iconContainer,
              gradientMap[iconGradient],
              shadowMap[iconGradient]
            )}
          >
            <Icon className={cn(config.icon, "text-primary-foreground")} />
          </div>
          {/* Decorative pulse dot */}
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
        </div>
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
