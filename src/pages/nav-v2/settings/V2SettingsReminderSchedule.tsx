import { TimeInputInline } from "@/components/ui/time-input";
import {
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

type ReminderSettings = V2SettingsControls["reminders"];

interface V2SettingsReminderScheduleProps {
  copy: Record<string, string>;
  reminders: ReminderSettings;
  moodCheckInsEnabled: boolean;
  focusReminderEnabled: boolean;
  onChange: (
    value: ReminderSettings | ((previous: ReminderSettings) => ReminderSettings)
  ) => Promise<void>;
}

export function V2SettingsReminderSchedule({
  copy,
  reminders,
  moodCheckInsEnabled,
  focusReminderEnabled,
  onChange,
}: V2SettingsReminderScheduleProps) {
  const dayOptions = [
    { value: 1, label: copy.mon || "Mon" },
    { value: 2, label: copy.tue || "Tue" },
    { value: 3, label: copy.wed || "Wed" },
    { value: 4, label: copy.thu || "Thu" },
    { value: 5, label: copy.fri || "Fri" },
    { value: 6, label: copy.sat || "Sat" },
    { value: 0, label: copy.sun || "Sun" },
  ];

  return (
    <SettingsInset testId="settings-v2-reminder-schedule">
      {moodCheckInsEnabled ? (
        <>
          <TimeInputInline
            label={copy.morning || "Morning"}
            value={reminders.moodTimeMorning || "09:00"}
            onChange={(value) => onChange((previous) => ({ ...previous, moodTimeMorning: value }))}
          />
          <TimeInputInline
            label={copy.afternoon || "Afternoon"}
            value={reminders.moodTimeAfternoon || "14:00"}
            onChange={(value) =>
              onChange((previous) => ({ ...previous, moodTimeAfternoon: value }))
            }
          />
          <TimeInputInline
            label={copy.evening || "Evening"}
            value={reminders.moodTimeEvening || "20:00"}
            onChange={(value) => onChange((previous) => ({ ...previous, moodTimeEvening: value }))}
          />
        </>
      ) : null}

      {focusReminderEnabled ? (
        <TimeInputInline
          label={copy.focusReminder || "Focus reminder"}
          value={reminders.focusTime || "10:00"}
          onChange={(value) => onChange((previous) => ({ ...previous, focusTime: value }))}
        />
      ) : null}

      <div>
        <SettingsFieldHeader title={copy.reminderDays || "Reminder days"} />
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={copy.reminderDays || "Reminder days"}
        >
          {dayOptions.map(({ value, label }) => (
            <SettingsChoiceButton
              key={value}
              onClick={() =>
                onChange((previous) => ({
                  ...previous,
                  days: previous.days.includes(value)
                    ? previous.days.filter((day) => day !== value)
                    : [...previous.days, value].sort((left, right) => left - right),
                }))
              }
              selected={reminders.days.includes(value)}
              presentation="compact"
              selectedTone="solid"
              surface="secondary"
            >
              {label}
            </SettingsChoiceButton>
          ))}
        </div>
        {reminders.days.length === 0 ? (
          <p
            role="status"
            className="mt-2 min-w-0 break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
          >
            {copy.settingsReminderChooseDay || "Choose days for mood and focus reminders."}
          </p>
        ) : null}
      </div>

      <div>
        <SettingsFieldHeader title={copy.quietHours || "Quiet hours"} />
        <div className="grid gap-2 sm:grid-cols-2">
          <TimeInputInline
            label={copy.quietHoursStart || "Quiet start"}
            value={reminders.quietHours.start || "22:00"}
            onChange={(value) =>
              onChange((previous) => ({
                ...previous,
                quietHours: { ...previous.quietHours, start: value },
              }))
            }
          />
          <TimeInputInline
            label={copy.quietHoursEnd || "Quiet end"}
            value={reminders.quietHours.end || "07:00"}
            onChange={(value) =>
              onChange((previous) => ({
                ...previous,
                quietHours: { ...previous.quietHours, end: value },
              }))
            }
          />
        </div>
      </div>
    </SettingsInset>
  );
}
