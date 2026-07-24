import { useEffect, useState } from "react";
import { Bell, BellRing, Focus, HeartPulse } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
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
  assertReminderReconcileApplied,
  isReminderReconcileOutcomeError,
  reconcilePersistedMasterReminders,
} from "@/lib/persistedReminderReconciliation";
import { buildReminderCopy } from "@/lib/reminderCopy";
import { isAndroid, isNative } from "@/lib/platform";
import { reconcileJournalReminderAtStartup } from "@/features/journal";
import { PanelFrame, SettingsStatus, ToggleRow } from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";
import {
  NotificationInlineAlert,
  NotificationSoundSettings,
  NotificationSystemGuidance,
} from "./V2SettingsNotificationFeedback";
import { V2SettingsReminderSchedule } from "./V2SettingsReminderSchedule";

export function NotificationsPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [soundState, setSoundState] = useState<{
    selected: NotificationSoundType;
    error: string | null;
    isUpdating: boolean;
  }>(() => ({ selected: getNotificationSound(), error: null, isUpdating: false }));
  const {
    selected: selectedSound,
    error: soundUpdateError,
    isUpdating: isUpdatingSound,
  } = soundState;
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [isRequestingReminderPermission, setIsRequestingReminderPermission] = useState(false);
  const [reminderSaveError, setReminderSaveError] = useState<string | null>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(
    controls.privacy.pushNotifications === true
  );
  const [isSavingPushPreference, setIsSavingPushPreference] = useState(false);
  const [pushSaveError, setPushSaveError] = useState<string | null>(null);
  const [navigationIncident, setNavigationIncident] = useState<
    "permission-required" | "schedule-uncertain" | null
  >(() => {
    if (typeof window === "undefined") return null;
    const reason = new URLSearchParams(window.location.search).get("reminderIncident");
    return reason === "permission-required" || reason === "schedule-uncertain" ? reason : null;
  });
  useEffect(() => {
    if (!navigationIncident || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("reminderIncident");
    window.history.replaceState(window.history.state, "", url);
  }, [navigationIncident]);
  useEffect(() => {
    if (!isSavingPushPreference) {
      setPushNotificationsEnabled(controls.privacy.pushNotifications === true);
    }
  }, [controls.privacy.pushNotifications, isSavingPushPreference]);
  const notificationSystemSettingsDescription =
    tx[getNotificationSystemSettingsCopyKey()] ||
    (isAndroid
      ? "Your phone’s sound, vibration, and notification settings can silence or hide reminders."
      : "Your iPhone or iPad’s notification settings and Focus modes can silence or hide reminders.");
  const reminderCopy = buildReminderCopy(t);
  const moodCheckInsEnabled = controls.reminders.moodCheckInsEnabled ?? controls.reminders.enabled;
  const focusReminderEnabled =
    controls.reminders.focusReminderEnabled ?? controls.reminders.enabled;
  const hasTimedCategory = moodCheckInsEnabled || focusReminderEnabled;
  const setReminder = async (
    value:
      | V2SettingsControls["reminders"]
      | ((prev: V2SettingsControls["reminders"]) => V2SettingsControls["reminders"])
  ): Promise<void> => {
    setReminderSaveError(null);
    try {
      await controls.onRemindersChange(value);
    } catch (error) {
      logger.error("[Notifications] Failed to save reminder settings:", error);
      setReminderSaveError(
        tx.settingsPreferenceSaveError ||
          "Couldn’t save this change. Your previous setting is still active."
      );
    }
  };
  const reconcileCurrentReminders = async (previousChannelId?: string): Promise<void> => {
    const result = await reconcilePersistedMasterReminders(
      {
        ...reminderCopy,
        quickMoodBody: t.howAreYouNow,
        channelCopy: buildNotificationChannelCopy(tx),
      },
      { rollbackChannelId: previousChannelId }
    );
    assertReminderReconcileApplied(result);
    await reconcileJournalReminderAtStartup({
      reminderTitle: t.journalReminderNotifTitle,
      reminderBody: t.journalReminderNotifBody,
    });
  };
  const updateSound = async (sound: NotificationSoundType) => {
    if (isUpdatingSound || sound === selectedSound) return;
    const previousSound = selectedSound;
    const rollbackChannelId = NOTIFICATION_SOUNDS.find(
      (option) => option.id === previousSound
    )?.channelId;
    setSoundState((previous) => ({ ...previous, error: null, isUpdating: true }));
    let newSoundSaved = false;
    let masterRemindersReconciled = false;
    try {
      await updateNotificationSound(sound);
      newSoundSaved = true;
      const result = await reconcilePersistedMasterReminders(
        {
          ...reminderCopy,
          quickMoodBody: t.howAreYouNow,
          channelCopy: buildNotificationChannelCopy(tx),
        },
        { rollbackChannelId }
      );
      assertReminderReconcileApplied(result);
      masterRemindersReconciled = true;
      await reconcileJournalReminderAtStartup({
        reminderTitle: t.journalReminderNotifTitle,
        reminderBody: t.journalReminderNotifBody,
      });
      setSoundState((previous) => ({ ...previous, selected: sound }));
      setNavigationIncident(null);
    } catch (error) {
      logger.error("[Notifications] Failed to reschedule reminders after sound change:", error);
      let previousPreferenceRestored =
        !newSoundSaved && getNotificationSound() === previousSound;
      let previousSchedulesRestored =
        !newSoundSaved ||
        (!masterRemindersReconciled &&
          isReminderReconcileOutcomeError(error) &&
          error.nativeState === "restored");
      if (newSoundSaved) {
        try {
          await updateNotificationSound(previousSound);
          previousPreferenceRestored = true;
          if (masterRemindersReconciled || !previousSchedulesRestored) {
            await reconcileCurrentReminders();
            previousSchedulesRestored = true;
          }
        } catch (rollbackError) {
          logger.error(
            "[Notifications] Failed to restore the previous reminder sound:",
            rollbackError
          );
        }
      }
      const previousStateRestored = previousPreferenceRestored && previousSchedulesRestored;
      setSoundState((previous) => ({
        ...previous,
        selected: previousPreferenceRestored ? previousSound : sound,
        error: previousStateRestored
          ? tx.notificationSoundUpdateFailed ||
            "ZenFlow could not apply this reminder sound. Your previous sound is still selected. Try again."
          : tx.notificationSoundUpdateUncertain ||
            "ZenFlow could not finish changing the reminder sound. Check the selected sound and try again.",
      }));
    } finally {
      setSoundState((previous) => ({ ...previous, isUpdating: false }));
    }
  };
  const handleReminderToggle = async (checked: boolean) => {
    setPermissionWarning(null);

    if (!checked) {
      await setReminder((prev) => ({ ...prev, enabled: false }));
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

      await setReminder((prev) => ({ ...prev, enabled: true }));
      setNavigationIncident(null);
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
  const handlePushPreferenceChange = async (checked: boolean) => {
    if (isSavingPushPreference) return;
    const previous = controls.privacy.pushNotifications === true;
    setPushNotificationsEnabled(checked);
    setPushSaveError(null);
    setIsSavingPushPreference(true);
    try {
      await controls.onPrivacyChange((privacy) =>
        applyPushNotificationsPreference(privacy, checked)
      );
    } catch (error) {
      logger.error("[Notifications] Failed to save account reminder preference:", error);
      setPushNotificationsEnabled(previous);
      setPushSaveError(
        tx.settingsPreferenceSaveError ||
          "Couldn’t save this change. Your previous setting is still active."
      );
    } finally {
      setIsSavingPushPreference(false);
    }
  };

  if (!isNative) return null;

  return (
    <PanelFrame
      icon={Bell}
      title={tx.settingsGroupReminders || "Reminders"}
      description={
        tx.remindersDescription ||
        "Turns mood, focus, and habit reminders on or off. Set each habit’s time in its own menu."
      }
      testId="settings-v2-panel-notifications"
    >
      {navigationIncident ? (
        <NotificationInlineAlert testId={`settings-v2-reminder-incident-${navigationIncident}`}>
          {navigationIncident === "permission-required"
            ? tx.pushPermissionDenied ||
              tx.notificationTestNoPermission ||
              "Turn on notifications for ZenFlow in your device settings."
            : tx.reminderReconcileUncertain ||
              "ZenFlow could not finish updating reminders. Some reminders may be missing or duplicated."}
        </NotificationInlineAlert>
      ) : null}

      <ToggleRow
        icon={Bell}
        title={tx.enableReminders || "Enable reminders"}
        description={
          tx.remindersDescription ||
          "Turns mood, focus, and habit reminders on or off. Set each habit’s time in its own menu."
        }
        checked={controls.reminders.enabled}
        onCheckedChange={(checked) => {
          void handleReminderToggle(checked);
        }}
        disabled={isRequestingReminderPermission}
        testId="settings-v2-reminders-toggle"
      />

      {permissionWarning && (
        <NotificationInlineAlert testId="settings-v2-reminders-permission-warning">
          {permissionWarning}
        </NotificationInlineAlert>
      )}
      {reminderSaveError && (
        <NotificationInlineAlert testId="settings-v2-reminders-save-error">
          {reminderSaveError}
        </NotificationInlineAlert>
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

      {controls.reminders.enabled && (
        <SettingsStatus>
          {tx.habitRemindersManagedInHabits || "Set a reminder from the habit's own menu."}
        </SettingsStatus>
      )}

      {controls.reminders.enabled && hasTimedCategory && (
        <V2SettingsReminderSchedule
          copy={tx}
          reminders={controls.reminders}
          moodCheckInsEnabled={moodCheckInsEnabled}
          focusReminderEnabled={focusReminderEnabled}
          onChange={setReminder}
        />
      )}

      {isPushAvailable() ? (
        <ToggleRow
          icon={BellRing}
          title={tx.privacyPushNotifications || "Account reminders"}
          description={
            tx.privacyPushNotificationsHint ||
            "Receive reminders from your account on this device. Reminders you set here work separately."
          }
          checked={pushNotificationsEnabled}
          disabled={isSavingPushPreference}
          onCheckedChange={(checked) => {
            void handlePushPreferenceChange(checked);
          }}
          surfaceWeight="quiet"
          testId="settings-v2-push-notifications"
        />
      ) : null}

      {pushSaveError ? (
        <NotificationInlineAlert testId="settings-v2-push-save-error">
          {pushSaveError}
        </NotificationInlineAlert>
      ) : null}

      {isAndroid && (
        <NotificationSoundSettings
          copy={tx}
          selectedSound={selectedSound}
          isUpdating={isUpdatingSound}
          error={soundUpdateError}
          onSelect={(sound) => {
            void updateSound(sound);
          }}
        />
      )}

      <NotificationSystemGuidance copy={tx} description={notificationSystemSettingsDescription} />
    </PanelFrame>
  );
}
