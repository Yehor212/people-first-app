import { CheckCircle2, Timer } from "lucide-react";
import type { FocusSession } from "@/types";
import type { PlanningMode } from "./planningFeatureModel";

interface PlanningReviewLaneProps {
  focusMinutesToday: number;
  lastFocusSession: FocusSession | null;
  labels: Record<string, string>;
  language: string;
  onModeChange: (mode: PlanningMode) => void;
}

export function PlanningReviewLane({
  focusMinutesToday,
  lastFocusSession,
  labels,
  language,
  onModeChange,
}: PlanningReviewLaneProps) {
  const numberFormatter = new Intl.NumberFormat(language, { useGrouping: false });

  return (
    <section
      data-testid="planning-review-lane"
      className="rounded-2xl border border-border/45 bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/80 text-primary">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{labels.planningModeReview}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">
              {numberFormatter.format(focusMinutesToday)}
            </span>{" "}
            {labels.todayMinutes}
            {lastFocusSession?.label ? (
              <>
                <span aria-hidden="true"> · </span>
                <bdi dir="auto">{lastFocusSession.label}</bdi>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <button
        type="button"
        data-testid="planning-review-focus-action"
        onClick={() => onModeChange("focus")}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border/50 bg-secondary/70 px-4 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Timer className="h-4 w-4" aria-hidden="true" />
        {labels.planningActionStartFocus}
      </button>
    </section>
  );
}
