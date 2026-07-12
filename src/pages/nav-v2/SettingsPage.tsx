import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Info,
  LockKeyhole,
  Palette,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { useAppStore } from "@/stores";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/lib/supabaseClient";
import { APP_VERSION } from "@/lib/appVersion";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { isNative } from "@/lib/platform";
import { interpolate } from "@/lib/utils";
import {
  SettingsHeroCard,
  SettingsModuleList,
  SettingsPageShell,
  type SettingsModuleCardData,
} from "./settings/components/SettingsPageComponents";
import { V2SettingsControlDeck } from "./settings/V2SettingsControlDeck";
import type { V2SettingsControls, V2SettingsSectionId } from "./settings/types";
import {
  readRequestedSettingsSection,
  resolveInitialSettingsSection,
  updateSettingsSectionUrl,
} from "./settings/settingsNavigation";

export type { V2SettingsControls };

const SyncHealthCard = lazy(() =>
  import("@/components/sync/SyncHealthCard").then((module) => ({
    default: module.SyncHealthCard,
  }))
);
const DeviceSessionsCard = lazy(() =>
  import("@/components/sync/DeviceSessionsCard").then((module) => ({
    default: module.DeviceSessionsCard,
  }))
);

interface SettingsPageProps {
  controls?: V2SettingsControls;
}

export const SettingsPage = memo(function SettingsPage({ controls }: SettingsPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const shouldScrollSelectedSectionRef = useRef(false);
  const detailPushedRef = useRef(false);
  const requestedSectionAtMountRef = useRef(readRequestedSettingsSection());
  const [selectedSectionId, setSelectedSectionId] = useState<V2SettingsSectionId>(() => {
    return (
      requestedSectionAtMountRef.current ||
      resolveInitialSettingsSection(controls?.initialOpenSection)
    );
  });
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    () => Boolean(requestedSectionAtMountRef.current || controls?.initialOpenSection)
  );
  const themePreference = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const audioSettings = useAppAudioSettings();
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const desktopLayout = useMediaQuery("(min-width: 1024px)");
  const settingsLead =
    tx.settingsOverviewDescription ||
    "Choose how ZenFlow looks, sounds, reminds you, and handles your data.";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) return;
      mainRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!controls?.initialOpenSection) return;
    const sectionId = resolveInitialSettingsSection(controls.initialOpenSection);
    setSelectedSectionId(sectionId);
    setMobileDetailOpen(true);
    updateSettingsSectionUrl(sectionId, "replaceState");
  }, [controls?.initialOpenSection]);

  useEffect(() => {
    const handlePopState = () => {
      const requestedSection = readRequestedSettingsSection();
      if (requestedSection) {
        detailPushedRef.current = Boolean(window.history.state?.zenflowSettingsDetail);
        setSelectedSectionId(requestedSection);
        setMobileDetailOpen(true);
        window.requestAnimationFrame(() => {
          document.getElementById(`settings-module-panel-${requestedSection}`)?.focus({
            preventScroll: true,
          });
        });
      } else {
        const sectionToRestore: V2SettingsSectionId = desktopLayout
          ? "appearance"
          : selectedSectionId;
        detailPushedRef.current = false;
        if (desktopLayout) setSelectedSectionId(sectionToRestore);
        setMobileDetailOpen(false);
        window.requestAnimationFrame(() => {
          document.getElementById(`settings-module-card-${sectionToRestore}`)?.focus({
            preventScroll: true,
          });
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [desktopLayout, selectedSectionId]);

  function openSection(sectionId: V2SettingsSectionId) {
    if (sectionId === selectedSectionId && (desktopLayout || mobileDetailOpen)) return;

    shouldScrollSelectedSectionRef.current = true;
    setSelectedSectionId(sectionId);
    setMobileDetailOpen(true);
    detailPushedRef.current = true;
    updateSettingsSectionUrl(sectionId, "pushState");
  }

  const closeSection = useCallback(() => {
    if (detailPushedRef.current) {
      window.history.back();
      return;
    }

    setMobileDetailOpen(false);
    updateSettingsSectionUrl(null, "replaceState");
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-module-card-${selectedSectionId}`)?.focus({
        preventScroll: true,
      });
    });
  }, [selectedSectionId]);

  useEffect(() => {
    if (desktopLayout || !mobileDetailOpen) return;
    return registerModalCloseCallback(() => {
      closeSection();
      return true;
    });
  }, [closeSection, desktopLayout, mobileDetailOpen]);

  useEffect(() => {
    if (!shouldScrollSelectedSectionRef.current || !mobileDetailOpen) return;
    shouldScrollSelectedSectionRef.current = false;

    const frame = window.requestAnimationFrame(() => {
      const isMobileWorkspace =
        typeof window.matchMedia !== "function" || window.matchMedia("(max-width: 1023px)").matches;
      if (!isMobileWorkspace) return;

      const selectedPanel = document.getElementById(`settings-module-panel-${selectedSectionId}`);
      if (!selectedPanel) return;

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      selectedPanel.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mobileDetailOpen, selectedSectionId]);

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
  const reminderSummary = !isNative
    ? tx.settingsRemindersMobileApp || "Mobile app"
    : controls?.reminders.enabled
      ? `${tx.moodReminder}: ${controls.reminders.moodTimeMorning || "09:00"}`
      : tx.settingsRemindersOff || tx.soundOff || "Off";
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
  const accountDescription =
    !supabase
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
    controls?.privacy.adConsent || controls?.privacy.pushNotifications,
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
        description: `${tx.navV2Theme}: ${themeLabel} · ${tx.language}`,
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
      {
        id: "notifications",
        icon: Clock3,
        label: tx.settingsGroupReminders || "Reminders",
        description: tx.remindersDescription,
        value: reminderSummary,
        role: "focus",
      },
      {
        id: "privacy",
        icon: LockKeyhole,
        label: tx.settingsGroupPrivacyData || "Privacy & data",
        description: dataSummary,
        value: privacySummary,
        role: "rest",
      },
      {
        id: "about",
        icon: Info,
        label: tx.settingsGroupHelpAbout || "Help & information",
        description: `ZenFlow ${APP_VERSION}`,
        role: "settings",
      },
    ],
    [
      audioSettings.canPlayFeedback,
      accountDescription,
      accountStatus,
      dataSummary,
      privacySummary,
      reminderSummary,
      soundSummary,
      themeLabel,
      tx.language,
      tx.navV2Theme,
      tx.settingsSoundDescription,
      tx.settingsSoundTitle,
      tx.remindersDescription,
      tx.settingsAccountBackupTitle,
      tx.settingsGroupAppearanceAccessibility,
      tx.settingsGroupHelpAbout,
      tx.settingsGroupPrivacyData,
      tx.settingsGroupReminders,
    ]
  );

  return (
    <Bloom key="settings-page" transition={staggerDelay("primary")}>
      <SettingsPageShell
        ref={mainRef}
        labelledBy="settings-page-heading"
        controlsWired={Boolean(controls)}
      >
        <SettingsHeroCard
          title={tx.navV2Settings}
          lead={settingsLead}
          themeTitle={tx.navV2Theme}
          themeLabel={themeLabel}
          controlsWired={Boolean(controls)}
          compactMobileDetail={Boolean(controls) && mobileDetailOpen && !desktopLayout}
        />

        {controls ? (
          <>
            <SettingsModuleList
              items={modules}
              expandedId={selectedSectionId}
              controlsWired={true}
              onOpen={openSection}
              onBack={closeSection}
              backLabel={tx.back}
              desktopLayout={desktopLayout}
              mobileDetailOpen={mobileDetailOpen}
              renderPanel={(item) => (
                <>
                  <V2SettingsControlDeck
                    controls={controls}
                    selectedSectionId={item.id}
                    accountSessionState={hasValidSession}
                  />
                  {item.id === "account" && supabase && hasValidSession === true && (
                    <Suspense fallback={null}>
                      <section
                        aria-label={
                          tx.settingsAccountBackupTitle || "Account & backup"
                        }
                        className="grid min-w-0 gap-3"
                        data-testid="settings-status-overview"
                      >
                        <SyncHealthCard
                          compact
                          dense
                          showHeader
                          allowManualRetry={false}
                          surface="settings-space"
                          quietWhenIdle
                        />
                        <DeviceSessionsCard dense surface="settings" />
                      </section>
                    </Suspense>
                  )}
                </>
              )}
              label={tx.settings || tx.navV2Settings}
            />
          </>
        ) : (
          <SettingsModuleList
            items={modules}
            expandedId={null}
            controlsWired={false}
            onOpen={openSection}
            onBack={closeSection}
            backLabel={tx.back}
            desktopLayout={desktopLayout}
            mobileDetailOpen={false}
            label={tx.settings || tx.navV2Settings}
            renderPanel={() => null}
          />
        )}
      </SettingsPageShell>
    </Bloom>
  );
});
