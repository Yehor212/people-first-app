import { AlertTriangle, CalendarDays, CheckCircle2, SmilePlus, Timer } from "lucide-react";
import type { PlanningDayPulse } from "./planningFeatureModel";

interface PlanningDayPulseProps {
  pulse: PlanningDayPulse;
  labels: Record<string, string>;
}

function interpolateCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function PlanningDayPulse({ pulse, labels }: PlanningDayPulseProps) {
  const items = [
    {
      id: "events",
      icon: CalendarDays,
      label: labels.planningPulseEvents,
      value: String(pulse.eventCount),
    },
    {
      id: "focus",
      icon: Timer,
      label: labels.planningPulseFocus,
      value: String(pulse.focusMinutesToday),
    },
    {
      id: "habits",
      icon: CheckCircle2,
      label: labels.planningPulseHabits,
      value: interpolateCount(labels.planningPulseHabitCount, pulse.pendingHabitCount),
    },
    {
      id: "mood",
      icon: SmilePlus,
      label: labels.planningPulseMood,
      value: pulse.moodLoggedToday ? labels.planningPulseMoodDone : labels.planningPulseMoodOpen,
    },
    ...(pulse.conflictCount > 0
      ? [
          {
            id: "conflicts",
            icon: AlertTriangle,
            label: labels.planningPulseConflicts,
            value: interpolateCount(labels.planningPulseConflictCount, pulse.conflictCount),
          },
        ]
      : []),
  ] as const;

  return (
    <section
      data-testid="planning-day-pulse"
      aria-label={labels.planningPulseTitle}
      className="rounded-2xl border border-border/45 bg-card/72 p-3 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
    >
      <p className="break-words px-1 text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:normal]">
        {labels.planningPulseTitle}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 md:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              data-testid={`planning-pulse-${item.id}`}
              className="min-h-[64px] min-w-0 rounded-xl border border-border/40 bg-secondary/45 px-3 py-2"
            >
              <div className="flex min-w-0 items-start gap-2 text-xs font-semibold text-muted-foreground">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">{item.label}</span>
              </div>
              <p className="mt-1 min-w-0 break-words text-base font-bold text-foreground [hyphens:manual] [overflow-wrap:normal]">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
