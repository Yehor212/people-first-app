import { CalendarDays, CheckCircle2, Clock3, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningMode } from "./planningFeatureModel";

interface PlanningModeRailProps {
  activeMode: PlanningMode;
  onModeChange: (mode: PlanningMode) => void;
  labels: Record<PlanningMode, string>;
}

const MODE_ITEMS = [
  { id: "today", icon: Clock3 },
  { id: "schedule", icon: CalendarDays },
  { id: "focus", icon: Timer },
  { id: "review", icon: CheckCircle2 },
] as const;

export function PlanningModeRail({ activeMode, onModeChange, labels }: PlanningModeRailProps) {
  return (
    <div
      data-testid="planning-mode-rail"
      className="grid grid-cols-1 gap-2 rounded-2xl border border-border/45 bg-card/70 p-1 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] min-[520px]:grid-cols-2 sm:flex sm:overflow-x-auto"
      role="group"
    >
      {MODE_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`planning-mode-${item.id}`}
            aria-pressed={active}
            onClick={() => onModeChange(item.id)}
            className={cn(
              "inline-flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-sm font-semibold whitespace-normal motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-w-[44px] sm:shrink-0",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
              {labels[item.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
