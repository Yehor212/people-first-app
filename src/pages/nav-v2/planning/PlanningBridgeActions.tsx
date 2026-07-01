import { BookOpenText, CalendarPlus, CheckCircle2, SmilePlus } from "lucide-react";
import type { PlanningBridgeAction } from "./planningFeatureModel";

interface PlanningBridgeActionsProps {
  actions: PlanningBridgeAction[];
  labels: Record<string, string>;
}

const ACTION_META = {
  log_mood: {
    icon: SmilePlus,
    labelKey: "planningBridgeLogMood",
    descriptionKey: "planningBridgeLogMoodDesc",
  },
  complete_habits: {
    icon: CheckCircle2,
    labelKey: "planningBridgeCompleteHabits",
    descriptionKey: "planningBridgeCompleteHabitsDesc",
  },
  reflect_in_diary: {
    icon: BookOpenText,
    labelKey: "planningBridgeReflectDiary",
    descriptionKey: "planningBridgeReflectDiaryDesc",
  },
  plan_tomorrow: {
    icon: CalendarPlus,
    labelKey: "planningBridgePlanTomorrow",
    descriptionKey: "planningBridgePlanTomorrowDesc",
  },
} as const;

const PAGE_PATHS = {
  orb: "/orb",
  habits: "/habits",
  diary: "/diary",
  planning: "/planning",
} as const;

export function buildPlanningBridgeHref(action: Pick<PlanningBridgeAction, "kind" | "targetPage">): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const path = PAGE_PATHS[action.targetPage];
  const params = new URLSearchParams(
    typeof window === "undefined" ? undefined : window.location.search,
  );
  params.set("nav", "v2");
  if (action.kind === "plan_tomorrow") {
    params.set("planningDate", "tomorrow");
  }
  const query = params.toString();
  return `${base}${path}${query ? `?${query}` : ""}`;
}

export function PlanningBridgeActions({ actions, labels }: PlanningBridgeActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="planning-bridge-actions"
      aria-label={labels.planningBridgeTitle}
      className="rounded-2xl border border-border/45 bg-card/72 p-4 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
    >
      <p className="text-sm font-semibold text-foreground">{labels.planningBridgeTitle}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {actions.map((action) => {
          const meta = ACTION_META[action.kind];
          const Icon = meta.icon;
          return (
            <a
              key={action.kind}
              href={buildPlanningBridgeHref(action)}
              data-testid={`planning-bridge-action-${action.kind}`}
              className="group flex min-h-[64px] items-center gap-3 rounded-xl border border-border/45 bg-secondary/50 px-3 py-2 text-start text-foreground touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{labels[meta.labelKey]}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {labels[meta.descriptionKey]}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
