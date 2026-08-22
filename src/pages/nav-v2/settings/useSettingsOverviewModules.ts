import { useMemo } from "react";
import { Clock3, LockKeyhole, Palette, UserRound, Volume2, VolumeX } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { languageNames } from "@/i18n/translations";
import { normalizeHabitReminderDays } from "@/lib/habitScheduling";
import { isNative } from "@/lib/platform";
import { supabase } from "@/lib/supabaseClient";
import { useAppStore } from "@/stores";
import { useThemeStore } from "@/stores/themeStore";

import type { SettingsModuleCardData } from "./components/SettingsPageComponents";
import type { V2SettingsControls } from "./types";

const isolateBidiText = (value: string): string => `\u2068${value}\u2069`;
const ignoreNameChange = () => undefined;

export type AccountAuthController = ReturnType<typeof useAccountAuth>;
export type AccountViewState =
  | "unavailable"
  | "checking"
  | "error"
  | "signed-out"
  | "signed-in";

export function resolveAccountViewState({
  backendAvailable,
  hasValidSession,
  auth,
}: {
  backendAvailable: boolean;
  hasValidSession: boolean | null;
  auth: Pick<AccountAuthController, "hasSession" | "sessionCheckState">;
}): AccountViewState {
  if (!backendAvailable) return "unavailable";
  if (auth.sessionCheckState === "error") return "error";
  if (hasValidSession === null || auth.sessionCheckState === "checking") return "checking";
  if (
    hasValidSession === true &&
    auth.hasSession &&
    auth.sessionCheckState === "signed-in"
  ) {
    return "signed-in";
  }
  if (
    hasValidSession === false &&
    !auth.hasSession &&
    auth.sessionCheckState === "signed-out"
  ) {
    return "signed-out";
  }
  return "error";
}

export function useSettingsOverviewModules(controls?: V2SettingsControls) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const themePreference = useThemeStore((state) => state.theme);
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const audioSettings = useAppAudioSettings();
  const hasValidSession = useAppStore((state) => state.hasValidSession);
  const accountAuth = useAccountAuth({
    onNameChange: controls?.onNameChange ?? ignoreNameChange,
    t: tx,
  });
  const accountViewState = resolveAccountViewState({
    backendAvailable: Boolean(supabase),
    hasValidSession,
    auth: accountAuth,
  });

  const settingsLead = isNative
    ? tx.settingsOverviewDescription ||
      "Choose how ZenFlow looks, sounds, reminds you, and handles your data."
    : tx.settingsOverviewDescriptionWithoutReminders ||
      "Choose how ZenFlow looks, sounds, and handles your data.";
  const themeLabel =
    themePreference === "auto"
      ? tx.themeSystem || "System"
      : themePreference === "oled"
        ? tx.oledDarkMode || "OLED"
        : appliedTheme === "paper"
          ? tx.themeLight
          : tx.themeDark;
  const soundSummary = audioSettings.canPlayFeedback
    ? tx.settingsSoundSummaryOn || tx.soundOn || "Sound on"
    : tx.settingsSoundSummaryOff || tx.soundOff || "Muted";
  const reminderSummary = (() => {
    if (!isNative) return tx.settingsRemindersMobileApp || "Mobile app";
    if (!controls?.reminders.enabled) return tx.settingsRemindersOff || tx.soundOff || "Off";

    const hasActiveHabitReminder = controls.habits.some(
      (habit) =>
        !habit.isArchived &&
        habit.reminders?.some(
          (reminder) => reminder.enabled && normalizeHabitReminderDays(reminder.days).length > 0
        )
    );
    const hasGlobalReminderDays = controls.reminders.days.length > 0;

    const summaries = [
      hasGlobalReminderDays && controls.reminders.moodCheckInsEnabled
        ? tx.settingsMoodCheckIns || "Mood check-ins"
        : null,
      hasGlobalReminderDays && controls.reminders.focusReminderEnabled
        ? tx.settingsFocusReminder || "Focus reminder"
        : null,
      hasActiveHabitReminder ? tx.reminderHabitTitle || "Habit reminder" : null,
    ].filter((summary): summary is string => Boolean(summary));
    if (summaries.length > 0) return summaries.join(" · ");
    if (
      !hasGlobalReminderDays &&
      (controls.reminders.moodCheckInsEnabled || controls.reminders.focusReminderEnabled)
    ) {
      return tx.settingsReminderDaysMissing || "Choose reminder days";
    }
    return tx.settingsRemindersOff || tx.soundOff || "Off";
  })();
  const dataSummary =
    tx.settingsDataBackupReportsDescription ||
    tx.settingsExportDescription ||
    "Save a backup you can import later, or create a report.";
  const accountStatus = accountAuth.signOutBlockReason
    ? tx.authSignOutRecoveryTitle || "Finish signing out"
    : accountViewState === "unavailable"
      ? tx.settingsAccountBackupUnavailable || "Backup isn’t available in this version"
      : accountViewState === "signed-out"
        ? tx.settingsAccountSignedOut || "You’re not signed in"
        : accountViewState === "checking"
          ? tx.settingsAccountBackupChecking || "Checking your account…"
          : accountViewState === "error"
            ? tx.settingsAccountCheckFailed || "We couldn’t check your account"
            : tx.settingsAccountSignedIn || "Signed in";
  const accountDescription = accountAuth.signOutBlockReason
    ? accountAuth.authStatus || tx.authSignOutFailed || "Sign-out did not complete."
    : accountViewState === "unavailable"
      ? tx.settingsAccountBackupUnavailableDescription || "Your data stays on this device."
      : accountViewState === "signed-out"
        ? tx.settingsAccountDataOnDevice ||
          "You can use ZenFlow without an account. Sign in to save new changes online and use them on your other devices."
        : accountViewState === "checking"
          ? tx.settingsAccountBackupCheckingDescription ||
            "Your data stays on this device while ZenFlow checks your account."
          : accountViewState === "error"
            ? tx.settingsAccountCheckFailedDescription ||
              "Your data stays on this device. Check your connection and try again."
            : tx.settingsAccountBackupDescription ||
              "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device.";
  const modules = useMemo<SettingsModuleCardData[]>(
    () => [
      {
        id: "account",
        icon: UserRound,
        label: tx.settingsAccountBackupTitle || "Account & backup",
        value: accountStatus,
        description: accountDescription,
        role: "space",
      },
      {
        id: "appearance",
        icon: Palette,
        label: tx.settingsGroupAppearanceAccessibility || "Appearance & accessibility",
        description: `${tx.language}: ${isolateBidiText(languageNames[language])}`,
        value: themeLabel,
        role: "mind",
      },
      {
        id: "sound",
        icon: audioSettings.canPlayFeedback ? Volume2 : VolumeX,
        label: tx.settingsSoundTitle || "Sound",
        description:
          tx.settingsSoundDescription || "Choose background sounds, activity sounds, and volume.",
        value: soundSummary,
        role: "settings",
      },
      ...(isNative
        ? [
            {
              id: "notifications" as const,
              icon: Clock3,
              label: tx.settingsGroupReminders || "Reminders",
              description: tx.remindersDescription,
              value: reminderSummary,
              role: "focus" as const,
            },
          ]
        : []),
      {
        id: "privacy",
        icon: LockKeyhole,
        label: tx.settingsGroupPrivacyData || "Privacy & data",
        description: dataSummary,
        role: "rest",
      },
    ],
    [
      accountDescription,
      accountStatus,
      audioSettings.canPlayFeedback,
      dataSummary,
      language,
      reminderSummary,
      soundSummary,
      themeLabel,
      tx.language,
      tx.remindersDescription,
      tx.settingsAccountBackupTitle,
      tx.settingsGroupAppearanceAccessibility,
      tx.settingsGroupPrivacyData,
      tx.settingsGroupReminders,
      tx.settingsSoundDescription,
      tx.settingsSoundTitle,
    ]
  );

  return {
    accountAuth,
    accountViewState,
    hasValidSession,
    modules,
    settingsLead,
    themeLabel,
  };
}
