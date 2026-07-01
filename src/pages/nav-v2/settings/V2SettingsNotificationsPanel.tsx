import { useMemo, useState } from "react";
import { AlertCircle, Bell, Volume2, Zap } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SmartRemindersCard } from "@/components/SmartRemindersCard";
import { TimeInputInline } from "@/components/ui/time-input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuickActions } from "@/hooks/useQuickActions";
import { logger } from "@/lib/logger";
import {
  getNotificationSound,
  getNotificationSystemSettingsCopyKey,
  NOTIFICATION_SOUNDS,
  updateNotificationSound,
  type NotificationSoundType,
} from "@/lib/notificationSounds";
import {
  scheduleHabitReminders,
  scheduleLocalReminders,
  scheduleMoodQuickLogNotification,
} from "@/lib/localNotifications";
import { isAndroid, isNative } from "@/lib/platform";
import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
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
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [isRequestingReminderPermission, setIsRequestingReminderPermission] = useState(false);
  const dayOptions = [
    { value: 1, label: tx.mon || "Mon" },
    { value: 2, label: tx.tue || "Tue" },
    { value: 3, label: tx.wed || "Wed" },
    { value: 4, label: tx.thu || "Thu" },
    { value: 5, label: tx.fri || "Fri" },
    { value: 6, label: tx.sat || "Sat" },
    { value: 0, label: tx.sun || "Sun" },
  ];
  const notificationSystemSettingsDescription =
    tx[getNotificationSystemSettingsCopyKey()] ||
    tx.notificationSystemSettingsDescription ||
    "Your device or browser notification settings keep final control over reminders.";
  const reminderCopy = useMemo(() => {
    const safeHabits = Array.isArray(controls.habits) ? controls.habits : [];
    const habitNameMap = new Map(safeHabits.map((habit) => [habit.id, habit.name]));
    const habitNames = controls.reminders.habitIds
      .map((id: string) => habitNameMap.get(id))
      .filter(Boolean);
    const habitBody =
      habitNames.length === 0
        ? t.reminderHabitBody
        : `${t.reminderHabitBody} ${habitNames.join(", ")}`;

    return {
      mood: { title: t.reminderMoodTitle, body: t.reminderMoodBody },
      habit: { title: t.reminderHabitTitle, body: habitBody },
      focus: { title: t.reminderFocusTitle, body: t.reminderFocusBody },
    };
  }, [controls.habits, controls.reminders.habitIds, t]);

  const setReminder = (
    value:
      | V2SettingsControls["reminders"]
      | ((prev: V2SettingsControls["reminders"]) => V2SettingsControls["reminders"])
  ) => controls.onRemindersChange(value);

  const updateSound = async (sound: NotificationSoundType) => {
    setSelectedSound(sound);
    await updateNotificationSound(sound);

    try {
      await scheduleLocalReminders(controls.reminders, reminderCopy);
      await scheduleHabitReminders(controls.habits, {
        reminderTitle: t.reminderHabitTitle,
        reminderBody: t.reminderHabitBody,
      });
      if (controls.reminders.enabled) {
        const [hour = 9, minute = 0] = (controls.reminders.moodTimeMorning || "09:00")
          .split(":")
          .map(Number);
        await scheduleMoodQuickLogNotification(
          { hour, minute },
          t.howAreYouNow || "How are you feeling? Tap! 😊",
        );
      }
    } catch (error) {
      logger.error("[Notifications] Failed to reschedule reminders after sound change:", error);
    }
  };

  const handleReminderToggle = async (checked: boolean) => {
    setPermissionWarning(null);

    if (!checked) {
      setReminder((prev) => ({ ...prev, enabled: false }));
      return;
    }

    if (!isNative) {
      setReminder((prev) => ({ ...prev, enabled: true }));
      return;
    }

    setIsRequestingReminderPermission(true);
    try {
      const current = await LocalNotifications.checkPermissions();
      const permission =
        current.display === "granted" ? current : await LocalNotifications.requestPermissions();

      if (permission.display !== "granted") {
        setPermissionWarning(
          tx.pushPermissionDenied ||
            tx.notificationTestNoPermission ||
            "Notification permission denied."
        );
        return;
      }

      setReminder((prev) => ({ ...prev, enabled: true }));
    } catch (error) {
      logger.error("[Notifications] Failed to request reminder permissions:", error);
      setPermissionWarning(
        tx.pushPermissionDenied ||
          tx.notificationTestNoPermission ||
          "Notification permission denied."
      );
    } finally {
      setIsRequestingReminderPermission(false);
    }
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
        onCheckedChange={(checked) => {
          void handleReminderToggle(checked);
        }}
        disabled={isRequestingReminderPermission}
        testId="settings-v2-reminders-toggle"
      />

      {permissionWarning && (
        <SettingsInset tone="danger" testId="settings-v2-reminders-permission-warning">
          <div className="flex items-start gap-3 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{permissionWarning}</span>
          </div>
        </SettingsInset>
      )}

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
                  onClick={() => {
                    void updateSound(sound.id);
                  }}
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

      <SettingsInset testId="settings-v2-notification-system-guidance">
        <SettingsFieldHeader
          icon={Bell}
          title={tx.notificationSystemSettingsTitle || "System notification controls"}
        />
        <SettingsStatus>{notificationSystemSettingsDescription}</SettingsStatus>
      </SettingsInset>

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
