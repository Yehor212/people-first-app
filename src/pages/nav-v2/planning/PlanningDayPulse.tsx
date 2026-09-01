import { AlertTriangle, CalendarDays, CheckCircle2, SmilePlus, Timer } from "lucide-react";
import type { PlanningDayPulse } from "./planningFeatureModel";

interface PlanningDayPulseProps {
  pulse: PlanningDayPulse;
  labels: Record<string, string>;
  language: string;
}

function interpolateCount(
  template: string,
  count: number,
  numberFormatter: Intl.NumberFormat,
): string {
  return template.replace("{count}", numberFormatter.format(count));
}

export function PlanningDayPulse({ pulse, labels, language }: PlanningDayPulseProps) {
  const numberFormatter = new Intl.NumberFormat(language, { useGrouping: false });
  const items = [
    {
      id: "events",
      icon: CalendarDays,
      label: labels.planningPulseEvents,
      value: numberFormatter.format(pulse.eventCount),
    },
    {
      id: "focus",
      icon: Timer,
      label: labels.planningPulseFocus,
      value: numberFormatter.format(pulse.focusMinutesToday),
    },
    {
      id: "habits",
      icon: CheckCircle2,
      label: labels.planningPulseHabits,
      value: interpolateCount(
        labels.planningPulseHabitCount,
        pulse.pendingHabitCount,
        numberFormatter,
      ),
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
            value: interpolateCount(
              labels.planningPulseConflictCount,
              pulse.conflictCount,
              numberFormatter,
            ),
          },
        ]
      : []),
  ] as const;

  return (
    <section
      data-testid="planning-day-pulse"
      aria-label={labels.planningPulseTitle}
      className="py-1"
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
              className="min-h-[64px] min-w-0 px-1 py-2"
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
