import { CalendarCheck2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  SettingsFieldHeader,
  SettingsSelectField,
} from "@/pages/nav-v2/settings/components/V2SettingsControlPrimitives";
import type { Habit, ScheduleEvent } from "@/types";

interface HabitPlanningMappingsFieldProps {
  habits: Habit[];
  candidates: ScheduleEvent[];
  mappings: Record<string, string>;
  onChange: (habitId: string, eventId: string | null) => void;
  disabled?: boolean;
}

function formatBlockTime(event: ScheduleEvent): string {
  const start = `${String(event.startHour).padStart(2, "0")}:${String(event.startMinute).padStart(2, "0")}`;
  const end = `${String(event.endHour).padStart(2, "0")}:${String(event.endMinute).padStart(2, "0")}`;
  return `\u2066${start}–${end}\u2069`;
}

export function HabitPlanningMappingsField({
  habits,
  candidates,
  mappings,
  onChange,
  disabled = false,
}: HabitPlanningMappingsFieldProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const candidatesByHabit = new Map<string, ScheduleEvent[]>();

  for (const candidate of candidates) {
    if (!candidate.habitId) continue;
    const existing = candidatesByHabit.get(candidate.habitId) ?? [];
    existing.push(candidate);
    candidatesByHabit.set(candidate.habitId, existing);
  }

  const eligibleHabits = habits.filter((habit) => (candidatesByHabit.get(habit.id)?.length ?? 0) > 0);

  return (
    <section
      className="space-y-3"
      aria-label={tx.connectedRecordsPlanningMappingsTitle || "Dedicated planning blocks"}
    >
      <SettingsFieldHeader
        icon={CalendarCheck2}
        title={tx.connectedRecordsPlanningMappingsTitle || "Dedicated planning blocks"}
        description={
          tx.connectedRecordsPlanningMappingsDescription ||
          "Choose one of today's reminder blocks for each habit you want to connect."
        }
      />

      {eligibleHabits.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {tx.connectedRecordsPlanningNoBlocks ||
            "Add an enabled reminder to a habit before connecting a planning block."}
        </p>
      ) : (
        eligibleHabits.map((habit) => {
          const options = candidatesByHabit.get(habit.id) ?? [];
          const inputId = `connected-records-planning-${habit.id}`;
          const nameId = `${inputId}-habit`;
          const hintId = `${inputId}-hint`;
          const selected = options.some((event) => event.id === mappings[habit.id])
            ? mappings[habit.id]
            : "";

          return (
            <div key={habit.id} className="space-y-2 rounded-[8px] border border-border/45 p-3">
              <p id={nameId} className="break-words text-sm font-semibold text-foreground">
                <span className="sr-only">
                  {tx.connectedRecordsPlanningHabitName || "Habit"}: {" "}
                </span>
                {habit.name}
              </p>
              <label
                htmlFor={inputId}
                className="block break-words text-sm text-muted-foreground"
              >
                {tx.connectedRecordsPlanningBlockLabel || "Today's dedicated block"}
              </label>
              <p id={hintId} className="sr-only">
                {tx.connectedRecordsRuleHabitPlanningHint ||
                  "Marks only the exact same-date block you choose after the habit is completed."}
              </p>
              <SettingsSelectField
                id={inputId}
                value={selected}
                onChange={(value) => onChange(habit.id, value || null)}
                ariaDescribedBy={`${nameId} ${hintId}`}
                disabled={disabled}
                options={[
                  {
                    value: "",
                    label: tx.connectedRecordsPlanningBlockNone || "Not connected",
                  },
                  ...options.map((event) => ({
                    value: event.id,
                    label: formatBlockTime(event),
                  })),
                ]}
              />
            </div>
          );
        })
      )}
    </section>
  );
}
