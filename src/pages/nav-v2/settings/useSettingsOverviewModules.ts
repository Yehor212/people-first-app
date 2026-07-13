import { useMemo } from "react";
import { Clock3, LockKeyhole, Palette, UserRound, Volume2, VolumeX } from "lucide-react";

import { useAds } from "@/contexts/AdContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { languageNames } from "@/i18n/translations";
import { isNative } from "@/lib/platform";
import { isPushAvailable } from "@/lib/pushNotifications";
import { supabase } from "@/lib/supabaseClient";
import { interpolate } from "@/lib/utils";
import { useAppStore } from "@/stores";
import { useThemeStore } from "@/stores/themeStore";

import type { SettingsModuleCardData } from "./components/SettingsPageComponents";
import type { V2SettingsControls } from "./types";

export function useSettingsOverviewModules(controls?: V2SettingsControls) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const themePreference = useThemeStore((state) => state.theme);
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const audioSettings = useAppAudioSettings();
  const { adsSupported } = useAds();
  const hasValidSession = useAppStore((state) => state.hasValidSession);

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
    if (controls.reminders.days.length === 0) {
      return tx.settingsReminderDaysMissing || "Choose reminder days";
    }

    const summaries = [
      controls.reminders.moodCheckInsEnabled
        ? tx.settingsMoodCheckIns || "Mood check-ins"
        : null,
      controls.reminders.focusReminderEnabled
        ? tx.settingsFocusReminder || "Focus reminder"
        : null,
    ].filter((summary): summary is string => Boolean(summary));
    return summaries.length > 0
      ? summaries.join(" · ")
      : tx.settingsRemindersOff || tx.soundOff || "Off";
  })();
  const dataSummary = controls
    ? interpolate(t.settingsDataSummary, {
        moods: controls.moods?.length ?? 0,
        habits: controls.habits.length,
        focus: controls.focusSessions?.length ?? 0,
      })
    : tx.settingsExportDescription;
  const accountStatus = !supabase
    ? tx.settingsAccountBackupUnavailable || "Backup isn’t available in this version"
    : hasValidSession === false
      ? tx.settingsAccountSignedOut || "You’re not signed in"
      : hasValidSession === null
        ? tx.settingsAccountBackupChecking || "Checking your account…"
        : tx.settingsAccountSignedIn || "Signed in";
  const accountDescription = !supabase
    ? tx.settingsAccountBackupUnavailableDescription || "Your data stays on this device."
    : hasValidSession === false
      ? tx.settingsAccountDataOnDevice ||
        "Your data stays on this device. Sign in to back it up and use it on your other devices."
      : hasValidSession === null
        ? tx.settingsAccountBackupCheckingDescription ||
          "Your data stays on this device while ZenFlow checks your account."
        : tx.settingsAccountBackupDescription ||
          "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device.";
  const hasOptionalPrivacyService = Boolean(
    (adsSupported && controls?.privacy.adConsent) ||
      (isPushAvailable() && controls?.privacy.pushNotifications),
  );
  const privacySummary = hasOptionalPrivacyService
    ? tx.privacyOptionalServicesOn || "Optional services on"
    : tx.privacyOptionalServicesOff || "Optional services off";

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
        description: `${tx.language}: ${languageNames[language]}`,
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
        value: privacySummary,
        role: "rest",
      },
    ],
    [
      accountDescription,
      accountStatus,
      audioSettings.canPlayFeedback,
      dataSummary,
      language,
      privacySummary,
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
    ],
  );

  return { hasValidSession, modules, settingsLead, themeLabel };
}
