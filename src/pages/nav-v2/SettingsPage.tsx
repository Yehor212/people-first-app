import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Cloud,
  Clock3,
  DatabaseBackup,
  Globe2,
  Info,
  LayoutGrid,
  LockKeyhole,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { getRoleTone, type NonOrbVisualRole } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import { ThemeToggleV2 } from "@/components/navigation-v2/ThemeToggleV2";
import { DeviceSessionsCard } from "@/components/sync/DeviceSessionsCard";
import { SyncHealthCard } from "@/components/sync/SyncHealthCard";
import { SettingsPanel, type SettingsPanelProps } from "@/components/SettingsPanel";
import { useFeatureFlags, type ToggleableFeature } from "@/contexts/FeatureFlagsContext";
import { useThemeStore } from "@/stores/themeStore";
import { useAppStore } from "@/stores";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/appVersion";

export type V2SettingsControls = Pick<
  SettingsPanelProps,
  | "userName"
  | "onNameChange"
  | "onResetData"
  | "reminders"
  | "onRemindersChange"
  | "habits"
  | "moods"
  | "focusSessions"
  | "gratitudeEntries"
  | "privacy"
  | "onPrivacyChange"
  | "onOpenWidgetSettings"
  | "initialOpenSection"
>;

interface SettingsPageProps {
  controls?: V2SettingsControls;
}

interface SettingsSection {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  role: NonOrbVisualRole;
}

interface SettingsCockpitCard {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  role: NonOrbVisualRole;
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

const SETTINGS_PANEL_SECTION_BY_CARD: Record<string, string> = {
  profile: "profile",
  appearance: "profile",
  language: "profile",
  modules: "modules",
  notifications: "notifications",
  privacy: "security",
  data: "data",
  account: "account",
  about: "about",
};

export const SettingsPage = memo(function SettingsPage({ controls }: SettingsPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const controlDeckRef = useRef<HTMLElement>(null);
  const [requestedSection, setRequestedSection] = useState<string | undefined>(
    controls?.initialOpenSection,
  );
  const [selectedCardId, setSelectedCardId] = useState<string>("profile");
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const { flags } = useFeatureFlags();
  const settingsTone = getRoleTone("settings");
  const SettingsIcon = V2_NAV_ICONS.settings;
  const settingsLead = `${tx.settingsCloudSyncTitle}: ${tx.settingsCloudSyncDescription}`;

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSectionOpen = useCallback((sectionId: string) => {
    const targetSection = SETTINGS_PANEL_SECTION_BY_CARD[sectionId];
    if (targetSection) {
      setSelectedCardId(sectionId);
      setRequestedSection(targetSection);
    }

    if (controls && controlDeckRef.current) {
      const scrollToDeck = () =>
        controlDeckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
        window.requestAnimationFrame(scrollToDeck);
      } else {
        scrollToDeck();
      }
    }
  }, [controls]);

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
  const sections = useMemo<SettingsSection[]>(
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
  const cockpitCards = useMemo<SettingsCockpitCard[]>(
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
      <main
        ref={mainRef}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto flex min-h-[100svh] max-w-3xl flex-col gap-4 px-4 py-6 outline-none md:px-6 md:py-10"
        aria-labelledby="settings-page-heading"
        data-testid="settings-page"
        data-visual-role="settings"
        data-controls-wired={controls ? "true" : "false"}
      >
        <section
          className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--zf-role-settings)/0.24)] bg-[linear-gradient(145deg,hsl(var(--card)/0.92),hsl(var(--surface-elevated)/0.88)_52%,hsl(var(--zf-role-space)/0.08))] p-5 shadow-[var(--zen-shadow-soft)] backdrop-blur-xl md:p-7"
          data-testid="settings-page-control-card"
        >
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[hsl(var(--zf-role-settings)/0.12)] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[hsl(var(--zf-role-rest)/0.10)] blur-3xl"
          />

          <div className="relative flex items-start gap-4">
            <span
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border shadow-sm",
                settingsTone.iconClass,
              )}
            >
              <SettingsIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--zf-role-settings)/0.76)]">
                ZENFLOW
              </p>
              <h1
                id="settings-page-heading"
                className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground"
              >
                {tx.navV2Settings}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground font-body">
                {settingsLead}
              </p>
            </div>
          </div>

          <div className="relative mt-5 rounded-3xl border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-3 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--zf-role-mind)/0.12)] text-[hsl(var(--zf-role-mind))]">
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {tx.navV2Theme}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {themeLabel}
                  </span>
                </span>
              </div>
              <ThemeToggleV2
                collapsed
                className="rounded-full border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.72)] px-2"
                testId="settings-v2-theme-toggle"
              />
            </div>
          </div>
        </section>

        <SyncHealthCard
          dense
          allowManualRetry={false}
          className="border-[hsl(var(--zf-role-space)/0.24)] bg-[hsl(var(--card)/0.76)] shadow-[var(--zen-shadow-card)]"
        />

        <DeviceSessionsCard
          dense
          className="border-[hsl(var(--zf-role-settings)/0.24)] bg-[hsl(var(--card)/0.76)] shadow-[var(--zen-shadow-card)]"
        />

        <section
          className="rounded-[1.75rem] border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-3 shadow-[var(--zen-shadow-card)] backdrop-blur-xl"
          aria-label={tx.settings || tx.navV2Settings}
          data-testid="settings-cockpit"
        >
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            {cockpitCards.map((item) => {
              const tone = getRoleTone(item.role);
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSectionOpen(item.id)}
                  aria-pressed={selectedCardId === item.id}
                  aria-controls={controls ? "settings-v2-control-deck" : undefined}
                  aria-label={`${item.label}: ${item.value}. ${item.description}`}
                  className={cn(
                    "group relative min-h-[132px] overflow-hidden rounded-3xl border bg-[hsl(var(--background)/0.44)] p-4 text-start",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
                    "motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--card)/0.9)]",
                    selectedCardId === item.id
                      ? "border-[hsl(var(--zf-role-settings)/0.48)] shadow-[0_18px_46px_-28px_hsl(var(--zf-role-settings)/0.82)]"
                      : tone.borderClass,
                  )}
                  data-testid={`settings-cockpit-card-${item.id}`}
                  data-visual-role={item.role}
                >
                  <span
                    aria-hidden="true"
                    className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
                  />
                  <span className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                        tone.iconClass,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-2 block text-base font-semibold leading-tight text-foreground">
                        {item.value}
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="grid gap-3 min-[520px]:grid-cols-2"
          aria-label={tx.navV2Settings}
          data-testid="settings-page-sections"
        >
          {sections.map((item) => {
            const tone = getRoleTone(item.role);
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSectionOpen(item.id)}
                className={cn(
                  "relative min-h-[116px] overflow-hidden rounded-3xl border bg-[hsl(var(--card)/0.76)] p-4 text-start shadow-[var(--zen-shadow-card)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zf-role-settings)/0.52)] focus-visible:ring-offset-2",
                  "motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--card)/0.88)]",
                  tone.borderClass,
                  selectedCardId === item.id &&
                    "border-[hsl(var(--zf-role-settings)/0.48)] bg-[hsl(var(--card)/0.92)]",
                )}
                data-testid={`settings-section-${item.id}`}
                data-visual-role={item.role}
                aria-pressed={selectedCardId === item.id}
                aria-controls={controls ? "settings-v2-control-deck" : undefined}
                aria-label={`${item.label}: ${item.description}`}
              >
                <span
                  aria-hidden="true"
                  className={cn("absolute inset-x-5 top-0 h-[2px] rounded-b-full", tone.railClass)}
                />
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                      tone.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {controls && (
          <section
            ref={controlDeckRef}
            id="settings-v2-control-deck"
            className="scroll-mt-6"
            aria-label={tx.settings || tx.navV2Settings}
            data-testid="settings-page-control-deck"
          >
            {selectedSection && (
              <div
                className="mb-3 rounded-3xl border border-[hsl(var(--border)/0.58)] bg-[hsl(var(--card)/0.72)] p-4 shadow-[var(--zen-shadow-card)]"
                data-testid="settings-page-control-deck-header"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--zf-role-settings)/0.12)] text-[hsl(var(--zf-role-settings))]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {selectedSection.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {selectedSection.description}
                    </span>
                  </span>
                </div>
              </div>
            )}
            <SettingsPanel
              {...controls}
              initialOpenSection={requestedSection || controls.initialOpenSection}
              showHeading={false}
              showSyncCards={false}
              className="content-with-nav"
            />
          </section>
        )}
      </main>
    </Bloom>
  );
});
