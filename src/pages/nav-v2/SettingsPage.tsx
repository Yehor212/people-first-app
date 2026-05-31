import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Cloud,
  Clock3,
  DatabaseBackup,
  Globe2,
  Info,
  LayoutGrid,
  LockKeyhole,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeviceSessionsCard } from "@/components/sync/DeviceSessionsCard";
import { SyncHealthCard } from "@/components/sync/SyncHealthCard";
import { useFeatureFlags, type ToggleableFeature } from "@/contexts/FeatureFlagsContext";
import { useThemeStore } from "@/stores/themeStore";
import { useAppStore } from "@/stores";
import { supabase } from "@/lib/supabaseClient";
import { APP_VERSION } from "@/lib/appVersion";
import {
  SettingsCockpit,
  SettingsControlDeckHeader,
  SettingsControlDeckRegion,
  SettingsHeroCard,
  SettingsPageShell,
  SettingsSectionGrid,
  type SettingsCockpitCardData,
  type SettingsPageCardData,
} from "./settings/components/SettingsPageComponents";
import { SettingsSectionSwitcher } from "./settings/components/SettingsSectionSwitcher";
import { V2SettingsControlDeck } from "./settings/V2SettingsControlDeck";
import type { V2SettingsControls, V2SettingsSectionId } from "./settings/types";

export type { V2SettingsControls };

interface SettingsPageProps {
  controls?: V2SettingsControls;
}

const OPTIONAL_MODULES: ToggleableFeature[] = [
  "focusTimer",
  "breathingExercise",
  "gratitudeJournal",
  "quests",
  "tasks",
  "challenges",
  "innerWorld",
];

const INITIAL_SECTION_TO_V2_SECTION: Record<string, V2SettingsSectionId> = {
  profile: "profile",
  appearance: "appearance",
  language: "language",
  modules: "modules",
  notifications: "notifications",
  privacy: "privacy",
  security: "privacy",
  data: "data",
  account: "account",
  about: "about",
};

export const SettingsPage = memo(function SettingsPage({ controls }: SettingsPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const controlDeckRef = useRef<HTMLElement>(null);
  const [selectedCardId, setSelectedCardId] = useState<V2SettingsSectionId>(
    INITIAL_SECTION_TO_V2_SECTION[controls?.initialOpenSection || "profile"] || "profile",
  );
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const { flags } = useFeatureFlags();
  const settingsLead = `${tx.settingsCloudSyncTitle}: ${tx.settingsCloudSyncDescription}`;

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!controls?.initialOpenSection) return;
    setSelectedCardId(
      INITIAL_SECTION_TO_V2_SECTION[controls.initialOpenSection] || "profile",
    );
  }, [controls?.initialOpenSection]);

  const openSection = useCallback((sectionId: V2SettingsSectionId, scrollToDeck = false) => {
    setSelectedCardId(sectionId);

    if (scrollToDeck && controls && controlDeckRef.current) {
      const scrollToSelectedDeck = () =>
        controlDeckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
        window.requestAnimationFrame(scrollToSelectedDeck);
      } else {
        scrollToSelectedDeck();
      }
    }
  }, [controls]);

  const handleSwitcherOpen = useCallback((sectionId: V2SettingsSectionId) => {
    openSection(sectionId);
  }, [openSection]);

  const handleOverviewOpen = useCallback((sectionId: V2SettingsSectionId) => {
    openSection(sectionId, true);
  }, [openSection]);

  const themeLabel = appliedTheme === "paper" ? tx.themeLight : tx.themeDark;
  const enabledOptionalModules = useMemo(
    () => OPTIONAL_MODULES.filter((moduleId) => flags[moduleId]).length,
    [flags],
  );
  const totalModules = OPTIONAL_MODULES.length + 2;
  const enabledModules = enabledOptionalModules + 2;
  const reminderSummary = controls?.reminders.enabled
    ? `${tx.moodReminder}: ${
        controls.reminders.moodTimeMorning || "09:00"
      } | ${tx.habitReminder}: ${controls.reminders.habitTime || "08:00"}`
    : tx.notificationsComingSoon || "Off";
  const dataSummary = controls
    ? `${controls.moods?.length ?? 0} ${tx.moodEntries} | ${controls.habits.length} ${
        tx.habits
      } | ${controls.focusSessions?.length ?? 0} ${tx.focus}`
    : tx.settingsExportDescription;
  const syncStatus = !supabase
    ? tx.cloudSyncDisabled || tx.settingsCloudSyncDisabledByUser
    : hasValidSession === false
      ? tx.sessionExpiredSettings
      : hasValidSession === null
        ? tx.syncing
        : tx.settingsCloudSyncEnabled;
  const syncDescription =
    hasValidSession === false
      ? tx.localDataSafe
      : tx.settingsCloudSyncDescription;
  const privacySummary = controls?.privacy.noTracking
    ? tx.privacyNoTracking
    : controls?.privacy.analytics
      ? tx.privacyAnalytics
      : tx.privacyDescription;
  const sections = useMemo<SettingsPageCardData[]>(
    () => [
      {
        id: "profile",
        icon: UserRound,
        label: tx.settingsGroupProfile || tx.profile || "Profile",
        description: tx.yourName || "Name, language, and personal preferences.",
        role: "settings",
      },
      {
        id: "appearance",
        icon: Palette,
        label: tx.appearance,
        description: `${tx.navV2Theme}: ${themeLabel}`,
        role: "mind",
      },
      {
        id: "notifications",
        icon: Bell,
        label: tx.notifications,
        description: tx.remindersDescription,
        role: "focus",
      },
      {
        id: "language",
        icon: Globe2,
        label: tx.language,
        description: tx.selectLanguage,
        role: "diary",
      },
      {
        id: "modules",
        icon: LayoutGrid,
        label: tx.settingsGroupModules || "Modules",
        description: tx.settingsModulesDescription || "Choose which ZenFlow tools stay visible.",
        role: "space",
      },
      {
        id: "privacy",
        icon: ShieldCheck,
        label: tx.settingsGroupSecurity,
        description: tx.settingsSecurityDesc,
        role: "rest",
      },
      {
        id: "data",
        icon: DatabaseBackup,
        label: tx.settingsSectionData,
        description: tx.settingsExportDescription,
        role: "space",
      },
      {
        id: "account",
        icon: UserRound,
        label: tx.settingsGroupAccount || tx.account || "Account",
        description: tx.accountSettingsDesc || tx.settingsAccountDesc || "Account and reset controls.",
        role: "focus",
      },
      {
        id: "about",
        icon: Info,
        label: tx.settingsGroupAbout,
        description: `ZenFlow ${APP_VERSION}`,
        role: "settings",
      },
    ],
    [
      themeLabel,
      tx.appearance,
      tx.account,
      tx.accountSettingsDesc,
      tx.language,
      tx.navV2Theme,
      tx.notifications,
      tx.profile,
      tx.remindersDescription,
      tx.selectLanguage,
      tx.settingsAccountDesc,
      tx.settingsGroupAccount,
      tx.settingsExportDescription,
      tx.settingsGroupAbout,
      tx.settingsGroupModules,
      tx.settingsGroupProfile,
      tx.settingsGroupSecurity,
      tx.settingsModulesDescription,
      tx.settingsSectionData,
      tx.settingsSecurityDesc,
      tx.yourName,
    ],
  );
  const selectedSection = sections.find((section) => section.id === selectedCardId);
  const cockpitCards = useMemo<SettingsCockpitCardData[]>(
    () => [
      {
        id: "account",
        icon: Cloud,
        label: tx.settingsCloudSyncTitle,
        value: syncStatus,
        description: syncDescription,
        role: "space",
      },
      {
        id: "notifications",
        icon: Clock3,
        label: tx.settingsGroupNotifications,
        value: reminderSummary,
        description: tx.remindersDescription,
        role: "focus",
      },
      {
        id: "modules",
        icon: LayoutGrid,
        label: tx.settingsGroupModules,
        value: `${enabledModules}/${totalModules}`,
        description: tx.settingsModulesDescription,
        role: "settings",
      },
      {
        id: "privacy",
        icon: LockKeyhole,
        label: tx.privacyTitle,
        value: privacySummary,
        description: tx.privacyDescription,
        role: "rest",
      },
      {
        id: "data",
        icon: DatabaseBackup,
        label: tx.settingsGroupData,
        value: dataSummary,
        description: tx.settingsExportDescription,
        role: "diary",
      },
    ],
    [
      dataSummary,
      enabledModules,
      privacySummary,
      reminderSummary,
      syncDescription,
      syncStatus,
      totalModules,
      tx.privacyDescription,
      tx.privacyTitle,
      tx.remindersDescription,
      tx.settingsCloudSyncTitle,
      tx.settingsExportDescription,
      tx.settingsGroupData,
      tx.settingsGroupModules,
      tx.settingsGroupNotifications,
      tx.settingsModulesDescription,
    ],
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
        />

        {controls && (
          <SettingsSectionSwitcher
            items={sections}
            selectedId={selectedCardId}
            controlsWired
            onOpen={handleSwitcherOpen}
            label={tx.settings || tx.navV2Settings}
          />
        )}

        {controls && (
          <SettingsControlDeckRegion
            ref={controlDeckRef}
            label={tx.settings || tx.navV2Settings}
          >
            {selectedSection && (
              <SettingsControlDeckHeader
                label={selectedSection.label}
                description={selectedSection.description}
              />
            )}
            <V2SettingsControlDeck controls={controls} selectedSectionId={selectedCardId} />
          </SettingsControlDeckRegion>
        )}

        <SyncHealthCard
          dense
          allowManualRetry={false}
          surface="settings-space"
        />

        <DeviceSessionsCard
          dense
          surface="settings"
        />

        <SettingsCockpit
          items={cockpitCards}
          selectedId={selectedCardId}
          controlsWired={Boolean(controls)}
          onOpen={handleOverviewOpen}
          label={tx.settings || tx.navV2Settings}
        />

        <SettingsSectionGrid
          items={sections}
          selectedId={selectedCardId}
          controlsWired={Boolean(controls)}
          onOpen={handleOverviewOpen}
          label={tx.navV2Settings}
        />
      </SettingsPageShell>
    </Bloom>
  );
});
