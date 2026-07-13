import { useState } from "react";
import { AlertCircle, Bell, BellRing, Focus, HeartPulse, Volume2 } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { TimeInputInline } from "@/components/ui/time-input";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { applyPushNotificationsPreference } from "@/lib/privacyConsent";
import { isPushAvailable } from "@/lib/pushNotifications";
import {
  getNotificationSound,
  getNotificationSystemSettingsCopyKey,
  buildNotificationChannelCopy,
  NOTIFICATION_SOUNDS,
  updateNotificationSound,
  type NotificationSoundType,
} from "@/lib/notificationSounds";
import {
  reconcileReminderNotifications,
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
  const [selectedSound, setSelectedSound] = useState<NotificationSoundType>(() =>
    getNotificationSound()
  );
  const [soundUpdateError, setSoundUpdateError] = useState<string | null>(null);
  const [isUpdatingSound, setIsUpdatingSound] = useState(false);
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
    (isAndroid
      ? "Your phone’s sound, vibration, and notification settings can silence or hide reminders."
      : "Your iPhone or iPad’s notification settings and Focus modes can silence or hide reminders.");
  const reminderCopy = {
    mood: { title: t.reminderMoodTitle, body: t.reminderMoodBody },
    habit: { title: t.reminderHabitTitle, body: t.reminderHabitBody },
    focus: { title: t.reminderFocusTitle, body: t.reminderFocusBody },
  };
  const moodCheckInsEnabled = controls.reminders.moodCheckInsEnabled ?? controls.reminders.enabled;
  const focusReminderEnabled =
    controls.reminders.focusReminderEnabled ?? controls.reminders.enabled;
  const hasTimedCategory = moodCheckInsEnabled || focusReminderEnabled;

  const setReminder = (
    value:
      | V2SettingsControls["reminders"]
      | ((prev: V2SettingsControls["reminders"]) => V2SettingsControls["reminders"])
  ) => controls.onRemindersChange(value);

  const updateSound = async (sound: NotificationSoundType) => {
    if (isUpdatingSound || sound === selectedSound) return;
    const previousSound = selectedSound;
    const rollbackChannelId = NOTIFICATION_SOUNDS.find(
      (option) => option.id === previousSound,
    )?.channelId;
    setSoundUpdateError(null);
    setIsUpdatingSound(true);
    let newSoundSaved = false;

    try {
      await updateNotificationSound(sound);
      newSoundSaved = true;
      await reconcileReminderNotifications(
        controls.reminders,
        controls.reminders.enabled ? controls.habits : [],
        {
          ...reminderCopy,
          quickMoodBody: t.howAreYouNow || "How are you feeling? Tap! 😊",
          channelCopy: buildNotificationChannelCopy(tx),
        },
        { rollbackChannelId },
      );
      setSelectedSound(sound);
    } catch (error) {
      logger.error("[Notifications] Failed to reschedule reminders after sound change:", error);
      let previousSoundRestored = false;
      try {
        await updateNotificationSound(previousSound);
        previousSoundRestored = true;
      } catch (rollbackError) {
        logger.error("[Notifications] Failed to restore the previous reminder sound:", rollbackError);
      }
      setSelectedSound(previousSoundRestored || !newSoundSaved ? previousSound : sound);
      setSoundUpdateError(
        previousSoundRestored || !newSoundSaved
          ? tx.notificationSoundUpdateFailed ||
              "ZenFlow could not apply this reminder sound. Your previous sound is still selected. Try again."
          : tx.notificationSoundUpdateUncertain ||
              "ZenFlow could not finish changing the reminder sound. Check the selected sound and try again.",
      );
    } finally {
      setIsUpdatingSound(false);
    }
  };

  const handleReminderToggle = async (checked: boolean) => {
    setPermissionWarning(null);

    if (!checked) {
      setReminder((prev) => ({ ...prev, enabled: false }));
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

  if (!isNative) return null;

  return (
    <PanelFrame
      icon={Bell}
      title={tx.settingsGroupReminders || "Reminders"}
      description={
        tx.remindersDescription || "Choose when ZenFlow reminds you about mood and focus."
      }
      testId="settings-v2-panel-notifications"
    >
      <ToggleRow
        icon={Bell}
        title={tx.enableReminders || "Enable reminders"}
        description={
          tx.remindersDescription || "Choose when ZenFlow reminds you about mood and focus."
        }
        checked={isNative && controls.reminders.enabled}
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
        <>
          <ToggleRow
            icon={HeartPulse}
            title={tx.settingsMoodCheckIns || "Mood check-ins"}
            description={
              tx.settingsMoodCheckInsDescription || "Gentle prompts to record how you feel."
            }
            checked={moodCheckInsEnabled}
            onCheckedChange={(checked) =>
              setReminder((prev) => ({ ...prev, moodCheckInsEnabled: checked }))
            }
            testId="settings-v2-mood-reminders-toggle"
          />
          <ToggleRow
            icon={Focus}
            title={tx.settingsFocusReminder || tx.focusReminder || "Focus reminder"}
            description={
              tx.settingsFocusReminderDescription || "One prompt around the time you choose."
            }
            checked={focusReminderEnabled}
            onCheckedChange={(checked) =>
              setReminder((prev) => ({ ...prev, focusReminderEnabled: checked }))
            }
            testId="settings-v2-focus-reminder-toggle"
          />
        </>
      )}

      {controls.reminders.enabled && hasTimedCategory && (
        <SettingsInset testId="settings-v2-reminder-schedule">
          {moodCheckInsEnabled ? (
            <>
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
            </>
          ) : null}
          {focusReminderEnabled ? (
            <TimeInputInline
              label={tx.focusReminder || "Focus reminder"}
              value={controls.reminders.focusTime || "10:00"}
              onChange={(value) => setReminder((prev) => ({ ...prev, focusTime: value }))}
            />
          ) : null}

          <SettingsStatus>
            {tx.habitRemindersManagedInHabits ||
              "Set a reminder from the habit's own menu."}
          </SettingsStatus>

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
            {controls.reminders.days.length === 0 ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                {tx.settingsReminderChooseDay ||
                  "Choose at least one day. No reminders will be sent until you do."}
              </p>
            ) : null}
          </div>

          <div>
            <SettingsFieldHeader title={tx.quietHours || "Quiet hours"} />
            <div className="grid gap-2 sm:grid-cols-2">
              <TimeInputInline
                label={tx.quietHoursStart || "Quiet start"}
                value={controls.reminders.quietHours.start || "22:00"}
                onChange={(value) =>
                  setReminder((prev) => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, start: value },
                  }))
                }
              />
              <TimeInputInline
                label={tx.quietHoursEnd || "Quiet end"}
                value={controls.reminders.quietHours.end || "07:00"}
                onChange={(value) =>
                  setReminder((prev) => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, end: value },
                  }))
                }
              />
            </div>
          </div>
        </SettingsInset>
      )}

      {isPushAvailable() ? (
        <ToggleRow
          icon={BellRing}
          title={tx.privacyPushNotifications || "Account reminders"}
          description={
            tx.privacyPushNotificationsHint ||
            "Receive reminders from your account on this device. Reminders you set here work separately."
          }
          checked={controls.privacy.pushNotifications === true}
          onCheckedChange={(checked) =>
            controls.onPrivacyChange((prev) => applyPushNotificationsPreference(prev, checked))
          }
          surfaceWeight="quiet"
          testId="settings-v2-push-notifications"
        />
      ) : null}

      {isAndroid && (
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
                  disabled={isUpdatingSound}
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
          {soundUpdateError && (
            <div
              role="alert"
              aria-label={soundUpdateError}
              className="mt-3 flex items-start gap-2 text-sm text-destructive"
              data-testid="settings-v2-notification-sound-error"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{soundUpdateError}</span>
            </div>
          )}
        </SettingsInset>
      )}

      {isNative && (
        <SettingsInset testId="settings-v2-notification-system-guidance">
          <SettingsFieldHeader
            icon={Bell}
            title={tx.notificationSystemSettingsTitle || "If reminders are silent"}
          />
          <SettingsStatus>{notificationSystemSettingsDescription}</SettingsStatus>
        </SettingsInset>
      )}
    </PanelFrame>
  );
}
