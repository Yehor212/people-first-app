import { useState } from "react";
import { Bell, Volume2, Zap } from "lucide-react";
import { SmartRemindersCard } from "@/components/SmartRemindersCard";
import { TimeInputInline } from "@/components/ui/time-input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuickActions } from "@/hooks/useQuickActions";
import {
  getNotificationSound,
  NOTIFICATION_SOUNDS,
  setNotificationSound,
  type NotificationSoundType,
} from "@/lib/notificationSounds";
import { isAndroid, isNative } from "@/lib/platform";
import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function NotificationsPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const quickActions = useQuickActions();
  const [selectedSound, setSelectedSound] = useState<NotificationSoundType>(() =>
    getNotificationSound()
  );
  const dayOptions = [
    { value: 1, label: tx.mon || "Mon" },
    { value: 2, label: tx.tue || "Tue" },
    { value: 3, label: tx.wed || "Wed" },
    { value: 4, label: tx.thu || "Thu" },
    { value: 5, label: tx.fri || "Fri" },
    { value: 6, label: tx.sat || "Sat" },
    { value: 0, label: tx.sun || "Sun" },
  ];

  const setReminder = (
    value:
      | V2SettingsControls["reminders"]
      | ((prev: V2SettingsControls["reminders"]) => V2SettingsControls["reminders"])
  ) => controls.onRemindersChange(value);

  const updateSound = (sound: NotificationSoundType) => {
    setSelectedSound(sound);
    setNotificationSound(sound);
  };

  return (
    <PanelFrame
      icon={Bell}
      title={tx.settingsGroupNotifications || tx.notifications || "Notifications"}
      description={tx.remindersDescription || "Gentle reminders throughout the day."}
      testId="settings-v2-panel-notifications"
    >
      <ToggleRow
        icon={Bell}
        title={tx.enableReminders || "Enable reminders"}
        description={tx.remindersDescription || "Get gentle nudges throughout the day."}
        checked={controls.reminders.enabled}
        onCheckedChange={(checked) => setReminder((prev) => ({ ...prev, enabled: checked }))}
        testId="settings-v2-reminders-toggle"
      />

      {controls.reminders.enabled && (
        <SettingsInset>
          <TimeInputInline
            label={tx.morning || "Morning"}
            value={controls.reminders.moodTimeMorning || "09:00"}
            onChange={(value) => setReminder((prev) => ({ ...prev, moodTimeMorning: value }))}
          />
          <TimeInputInline
            label={tx.afternoon || "Afternoon"}
            value={controls.reminders.moodTimeAfternoon || "14:00"}
            onChange={(value) => setReminder((prev) => ({ ...prev, moodTimeAfternoon: value }))}
          />
          <TimeInputInline
            label={tx.evening || "Evening"}
            value={controls.reminders.moodTimeEvening || "20:00"}
            onChange={(value) => setReminder((prev) => ({ ...prev, moodTimeEvening: value }))}
          />
          <TimeInputInline
            label={tx.habitReminder || "Habit reminder"}
            value={controls.reminders.habitTime || "08:00"}
            onChange={(value) => setReminder((prev) => ({ ...prev, habitTime: value }))}
          />
          <TimeInputInline
            label={tx.focusReminder || "Focus reminder"}
            value={controls.reminders.focusTime || "10:00"}
            onChange={(value) => setReminder((prev) => ({ ...prev, focusTime: value }))}
          />

          <div>
            <SettingsFieldHeader title={tx.reminderDays || "Reminder days"} />
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={tx.reminderDays || "Reminder days"}
            >
              {dayOptions.map(({ value, label }) => (
                <SettingsChoiceButton
                  key={value}
                  onClick={() =>
                    setReminder((prev) => ({
                      ...prev,
                      days: prev.days.includes(value)
                        ? prev.days.filter((day) => day !== value)
                        : [...prev.days, value].sort((a, b) => a - b),
                    }))
                  }
                  selected={controls.reminders.days.includes(value)}
                  presentation="compact"
                  selectedTone="solid"
                  surface="secondary"
                >
                  {label}
                </SettingsChoiceButton>
              ))}
            </div>
          </div>
        </SettingsInset>
      )}

      {controls.reminders.enabled && (
        <SmartRemindersCard
          currentSettings={controls.reminders}
          moods={controls.moods ?? []}
          habits={controls.habits}
          focusSessions={controls.focusSessions ?? []}
          onApplySuggestion={(type, time) => {
            if (type === "mood") {
              setReminder((prev) => ({ ...prev, moodTimeMorning: time }));
            } else if (type === "habit") {
              setReminder((prev) => ({ ...prev, habitTime: time }));
            } else if (type === "focus") {
              setReminder((prev) => ({ ...prev, focusTime: time }));
            }
          }}
        />
      )}

      {isNative && (
        <SettingsInset>
          <SettingsFieldHeader icon={Volume2} title={tx.notificationSound || "Notification sound"} />
          <SettingsButtonGrid columns="two">
            {NOTIFICATION_SOUNDS.map((sound) => {
              const label = tx[sound.labelKey] || sound.id;
              return (
                <SettingsChoiceButton
                  key={sound.id}
                  onClick={() => updateSound(sound.id)}
                  selected={selectedSound === sound.id}
                  surface="card"
                >
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {tx[`${sound.labelKey}Desc`] || sound.description}
                  </span>
                </SettingsChoiceButton>
              );
            })}
          </SettingsButtonGrid>
        </SettingsInset>
      )}

      {isAndroid && (
        <ToggleRow
          icon={Zap}
          title={tx.quickActions || "Quick actions"}
          description={tx.quickActionsDescription || "Android lock-screen actions."}
          checked={quickActions.isEnabled}
          onCheckedChange={(checked) => {
            void quickActions.toggle(checked);
          }}
          testId="settings-v2-quick-actions-toggle"
        />
      )}
    </PanelFrame>
  );
}
