import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "@container",
        "grid gap-3 @sm:gap-4",
        "grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  span?: "1" | "2" | "row";
  className?: string;
}

export function BentoCard({ children, span = "1", className }: BentoCardProps) {
  return (
    <div
      className={cn(
        "@container rounded-2xl border border-border/10 bg-card p-4 shadow-sm",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-150",
        span === "2" && "@sm:col-span-2",
        span === "row" && "col-span-full",
        className
      )}
    >
      {children}
    </div>
  );
}
