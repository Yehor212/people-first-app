import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer" | "pulse";
}

function Skeleton({ className, variant = "shimmer", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted",
        variant === "shimmer" && "shimmer",
        variant === "pulse" && "animate-pulse",
        variant === "default" && "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

// Pre-built skeleton patterns for common use cases
interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

function SkeletonCard({ className, lines = 2 }: SkeletonCardProps) {
  return (
    <div className={cn("bg-card rounded-2xl p-4 space-y-3 border shadow-zen-sm", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {lines > 0 && (
        <div className="space-y-2 pt-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3"
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SkeletonStatsProps {
  className?: string;
  count?: number;
}

function SkeletonStats({ className, count = 3 }: SkeletonStatsProps) {
  return (
    <div className={cn("grid gap-3", className)} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-secondary/50 rounded-xl p-3 text-center">
          <Skeleton className="h-7 w-12 mx-auto mb-2" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonListProps {
  className?: string;
  count?: number;
}

function SkeletonList({ className, count = 3 }: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SkeletonSectionProps {
  className?: string;
  hasIcon?: boolean;
}

function SkeletonSection({ className, hasIcon = true }: SkeletonSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Section header skeleton */}
      <div className="flex items-center gap-3">
        {hasIcon && <Skeleton className="w-10 h-10 rounded-xl" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      {/* Content skeleton */}
      <SkeletonCard />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonStats, SkeletonList, SkeletonSection };
export type { SkeletonProps, SkeletonCardProps, SkeletonStatsProps, SkeletonListProps, SkeletonSectionProps };
