import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Clock3,
  DatabaseBackup,
  Globe2,
  Info,
  LockKeyhole,
  Palette,
  UserRound,
} from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { useAppStore } from "@/stores";
import { supabase } from "@/lib/supabaseClient";
import { APP_VERSION } from "@/lib/appVersion";
import { DeviceSessionsCard } from "@/components/sync/DeviceSessionsCard";
import { SyncHealthCard } from "@/components/sync/SyncHealthCard";
import {
  SettingsHeroCard,
  SettingsModuleList,
  SettingsPageShell,
  type SettingsModuleCardData,
} from "./settings/components/SettingsPageComponents";
import { SettingsSectionSwitcher } from "./settings/components/SettingsSectionSwitcher";
import { V2SettingsControlDeck } from "./settings/V2SettingsControlDeck";
import type { V2SettingsControls, V2SettingsSectionId } from "./settings/types";

export type { V2SettingsControls };

interface SettingsPageProps {
  controls?: V2SettingsControls;
}

const INITIAL_SECTION_TO_V2_SECTION: Record<string, V2SettingsSectionId> = {
  profile: "profile",
  appearance: "appearance",
  language: "language",
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
  const [selectedSectionId, setSelectedSectionId] = useState<V2SettingsSectionId>(
    INITIAL_SECTION_TO_V2_SECTION[controls?.initialOpenSection || "profile"] || "profile"
  );
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const settingsLead = `${tx.settingsCloudSyncTitle}: ${tx.settingsCloudSyncDescription}`;

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!controls?.initialOpenSection) return;
    setSelectedSectionId(INITIAL_SECTION_TO_V2_SECTION[controls.initialOpenSection] || "profile");
  }, [controls?.initialOpenSection]);

  function openSection(sectionId: V2SettingsSectionId) {
    setSelectedSectionId(sectionId);
  }

  const themeLabel = appliedTheme === "paper" ? tx.themeLight : tx.themeDark;
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
    hasValidSession === false ? tx.localDataSafe : tx.settingsCloudSyncDescription;
  const privacySummary = controls?.privacy.noTracking
    ? tx.privacyNoTracking
    : controls?.privacy.analytics
      ? tx.privacyAnalytics
      : tx.privacyDescription;
  const modules = useMemo<SettingsModuleCardData[]>(
    () => [
      {
        id: "profile",
        icon: UserRound,
        label: tx.settingsGroupProfile || tx.profile || "Profile",
        description: tx.yourName || "Name, language, and personal preferences.",
        role: "settings",
      },
      {
        id: "account",
        icon: Cloud,
        label: tx.settingsCloudSyncTitle,
        value: syncStatus,
        description: syncDescription,
        role: "space",
      },
      {
        id: "appearance",
        icon: Palette,
        label: tx.appearance,
        description: `${tx.navV2Theme}: ${themeLabel}`,
        value: themeLabel,
        role: "mind",
      },
      {
        id: "notifications",
        icon: Clock3,
        label: tx.settingsGroupNotifications || tx.notifications,
        description: tx.remindersDescription,
        value: reminderSummary,
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
        id: "privacy",
        icon: LockKeyhole,
        label: tx.settingsGroupSecurity || tx.privacyTitle,
        description: tx.settingsSecurityDesc || tx.privacyDescription,
        value: privacySummary,
        role: "rest",
      },
      {
        id: "data",
        icon: DatabaseBackup,
        label: tx.settingsGroupData || tx.settingsSectionData,
        description: tx.settingsExportDescription,
        value: dataSummary,
        role: "space",
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
      dataSummary,
      privacySummary,
      reminderSummary,
      syncDescription,
      syncStatus,
      themeLabel,
      tx.appearance,
      tx.language,
      tx.navV2Theme,
      tx.notifications,
      tx.privacyDescription,
      tx.privacyTitle,
      tx.profile,
      tx.remindersDescription,
      tx.selectLanguage,
      tx.settingsCloudSyncTitle,
      tx.settingsExportDescription,
      tx.settingsGroupAbout,
      tx.settingsGroupData,
      tx.settingsGroupNotifications,
      tx.settingsGroupProfile,
      tx.settingsGroupSecurity,
      tx.settingsSectionData,
      tx.settingsSecurityDesc,
      tx.yourName,
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
        />

        {controls ? (
          <>
            <SettingsSectionSwitcher
              items={modules}
              selectedId={selectedSectionId}
              controlsWired={true}
              onOpen={openSection}
              label={tx.settings || tx.navV2Settings}
            />

            <section
              id="settings-v2-control-deck"
              className="grid gap-3"
              data-testid="settings-page-control-deck"
              data-selected-section={selectedSectionId}
            >
              <V2SettingsControlDeck controls={controls} selectedSectionId={selectedSectionId} />
            </section>

            <section
              aria-label={tx.settingsCloudSyncTitle || tx.settingsGroupAccount || "Sync status"}
              className="grid gap-3"
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
              {supabase && hasValidSession === true && (
                <DeviceSessionsCard dense surface="settings" />
              )}
            </section>
          </>
        ) : (
          <SettingsModuleList
            items={modules}
            expandedId={null}
            controlsWired={false}
            onOpen={openSection}
            label={tx.settings || tx.navV2Settings}
            renderPanel={() => null}
          />
        )}
      </SettingsPageShell>
    </Bloom>
  );
});
