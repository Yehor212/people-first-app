import { ArrowRight, CalendarPlus, CheckCircle2, Timer } from "lucide-react";
import type { PlanningFeatureModel, PlanningMode } from "./planningFeatureModel";

interface PlanningActionPanelProps {
  model: PlanningFeatureModel;
  labels: Record<string, string>;
  onModeChange: (mode: PlanningMode) => void;
  onScrollToTimeline: () => void;
}

export function PlanningActionPanel({
  model,
  labels,
  onModeChange,
  onScrollToTimeline,
}: PlanningActionPanelProps) {
  const action = (() => {
    if (model.primaryIntent === "add_first_event") {
      return { icon: CalendarPlus, label: labels.planningActionAddEvent, mode: "schedule" as const };
    }
    if (model.primaryIntent === "resume_focus" || model.primaryIntent === "start_focus_gap") {
      return { icon: Timer, label: labels.planningActionStartFocus, mode: "focus" as const };
    }
    if (model.primaryIntent === "review_recent_focus" || model.primaryIntent === "close_day") {
      return { icon: CheckCircle2, label: labels.planningActionReview, mode: "review" as const };
    }
    return { icon: ArrowRight, label: labels.planningActionOpenSchedule, mode: "schedule" as const };
  })();

  const Icon = action.icon;
  const intentLabel = labels[`planningIntent_${model.primaryIntent}`] ?? labels.planningActionTitle;

  return (
    <section
      data-testid="planning-action-panel"
      className="rounded-2xl border border-border/45 bg-card/72 p-4 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
    >
      <p className="text-sm font-semibold text-foreground">{labels.planningActionTitle}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{intentLabel}</p>
      <button
        type="button"
        data-testid="planning-primary-action"
        onClick={() => {
          onModeChange(action.mode);
          if (action.mode === "schedule") {
            onScrollToTimeline();
          }
        }}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </button>
    </section>
  );
}
