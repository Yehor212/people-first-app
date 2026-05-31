import { memo, useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe2,
  History,
  Info,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  RefreshCw,
  Scale,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Upload,
  UserRound,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { DopamineSettingsComponent } from "@/components/DopamineSettings";
import { FeedbackForm } from "@/components/FeedbackForm";
import { ChangelogPanel } from "@/components/ChangelogPanel";
import { LegalModal } from "@/components/LegalModal";
import { SmartRemindersCard } from "@/components/SmartRemindersCard";
import { DeviceSessionsCard } from "@/components/sync/DeviceSessionsCard";
import { SyncHealthCard } from "@/components/sync/SyncHealthCard";
import { TimeInputInline } from "@/components/ui/time-input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFeatureFlags, type ToggleableFeature } from "@/contexts/FeatureFlagsContext";
import { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "@/features/journal";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useDemoMode } from "@/hooks/useDemoMode";
import { FONT_SCALE_LEVELS, useFontScale } from "@/hooks/useFontScale";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useQuickActions } from "@/hooks/useQuickActions";
import { getAuthProviderConfig, type SocialAuthProviderConfig } from "@/lib/authProviders";
import {
  applyAdConsentPreference,
  applyAnalyticsPreference,
  applyNoTrackingPreference,
} from "@/lib/privacyConsent";
import { checkForAppUpdate, openGooglePlayStore, type UpdateState } from "@/lib/appUpdateManager";
import { APP_VERSION } from "@/lib/appVersion";
import { BASE_URL } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  getNotificationSound,
  NOTIFICATION_SOUNDS,
  setNotificationSound,
  type NotificationSoundType,
} from "@/lib/notificationSounds";
import { isAndroid, isNative } from "@/lib/platform";
import { sanitizeUserName } from "@/lib/sanitize";
import { safeLocalStorageGet, storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { cn } from "@/lib/utils";
import { updateProfileName } from "@/lib/accountService";
import { userNameSchema } from "@/lib/validation";
import { isFeatureUnlocked } from "@/lib/onboardingFlow";
import { Language, languageNames } from "@/i18n/translations";
import { ThemeOption, useTheme } from "@/components/ThemeToggle";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import { useDataImport } from "@/components/settings/data-section/useDataImport";
import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { useAccountSync } from "@/components/settings/account-section/useAccountSync";
import { useDeleteAccount } from "@/components/settings/account-section/useDeleteAccount";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, PanelFrame, ToggleRow } from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls, V2SettingsSectionId } from "./types";

interface V2SettingsControlDeckProps {
  controls: V2SettingsControls;
  selectedSectionId: V2SettingsSectionId;
}

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

const MODULES: Array<{
  id: "mood" | "habits" | ToggleableFeature;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  core?: boolean;
  feature?: ToggleableFeature;
}> = [
  {
    id: "mood",
    icon: CheckCircle2,
    titleKey: "settingsModuleMood",
    descriptionKey: "settingsModuleMoodDesc",
    core: true,
  },
  {
    id: "habits",
    icon: LayoutGrid,
    titleKey: "settingsModuleHabits",
    descriptionKey: "settingsModuleHabitsDesc",
    core: true,
  },
  {
    id: "focusTimer",
    icon: Clock3,
    titleKey: "settingsModuleFocus",
    descriptionKey: "settingsModuleFocusDesc",
    feature: "focusTimer",
  },
  {
    id: "breathingExercise",
    icon: Zap,
    titleKey: "settingsModuleBreathing",
    descriptionKey: "settingsModuleBreathingDesc",
    feature: "breathingExercise",
  },
  {
    id: "gratitudeJournal",
    icon: Sparkles,
    titleKey: "gratitude",
    descriptionKey: "journalDescription",
    feature: "gratitudeJournal",
  },
  {
    id: "quests",
    icon: CheckCircle2,
    titleKey: "settingsModuleQuests",
    descriptionKey: "settingsModuleQuestsDesc",
    feature: "quests",
  },
  {
    id: "tasks",
    icon: FileText,
    titleKey: "settingsModuleTasks",
    descriptionKey: "settingsModuleTasksDesc",
    feature: "tasks",
  },
  {
    id: "challenges",
    icon: Shield,
    titleKey: "settingsModuleChallenges",
    descriptionKey: "settingsModuleChallengesDesc",
    feature: "challenges",
  },
  {
    id: "innerWorld",
    icon: LayoutGrid,
    titleKey: "settingsModuleGarden",
    descriptionKey: "settingsModuleGardenDesc",
    feature: "innerWorld",
  },
];

const FONT_SCALE_LABELS: Record<number, string> = {
  0.85: "fontScaleTiny",
  0.9: "fontScaleSmall",
  1: "fontScaleDefault",
  1.1: "fontScaleMedium",
  1.2: "fontScaleLarge",
  1.3: "fontScaleXL",
  1.5: "fontScaleXXL",
};

function getStoredLockTimeoutMs(): number {
  return safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null) ?? 300_000;
}

function getProviderName(tx: Record<string, string>, provider: SocialAuthProviderConfig) {
  return tx[provider.nameKey] || provider.fallbackName;
}

function formatProviderText(
  tx: Record<string, string>,
  template: string | undefined,
  provider: SocialAuthProviderConfig
) {
  return (template || "Connect {provider}").replace("{provider}", getProviderName(tx, provider));
}

function ProfilePanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [name, setName] = useState(controls.userName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);

  useEffect(() => {
    setName(controls.userName);
    setNameStatus(null);
  }, [controls.userName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (!sanitized) return;

    try {
      userNameSchema.parse(sanitized);
    } catch {
      setNameStatus(tx.invalidNameFormat || "Invalid name format");
      return;
    }

    controls.onNameChange(sanitized);
    setNameStatus(tx.nameSaved || "Saved");

    try {
      const success = await updateProfileName(sanitized);
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved locally");
      }
    } catch (error) {
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved locally");
    }
  };

  return (
    <PanelFrame
      icon={UserRound}
      title={tx.settingsGroupProfile || tx.profile || "Profile"}
      description={tx.yourName || "Name and personal preferences."}
      testId="settings-v2-panel-profile"
    >
      <label
        className="block text-xs font-semibold text-muted-foreground"
        htmlFor="settings-v2-name"
      >
        {tx.yourName || "Your name"}
      </label>
      <div className="flex flex-col gap-2 min-[520px]:flex-row">
        <input
          id="settings-v2-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="min-h-[48px] flex-1 rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.48)] px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => {
            void handleNameSave();
          }}
          className="min-h-[48px] rounded-2xl px-5 text-sm font-semibold text-primary-foreground zen-gradient focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tx.save || "Save"}
        </button>
      </div>
      <div role="status" aria-live="polite">
        {nameStatus && <p className="text-xs text-muted-foreground">{nameStatus}</p>}
      </div>
    </PanelFrame>
  );
}

function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { theme, changeTheme } = useTheme();
  const [oledMode, setOledMode] = useState(() => storageGetRaw(SK.OLED_MODE) === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("oled", oledMode);
  }, [oledMode]);

  const updateOled = (checked: boolean) => {
    setOledMode(checked);
    storageSetRaw(SK.OLED_MODE, String(checked));
  };

  const themeOptions: Array<{ value: ThemeOption; icon: LucideIcon; label: string }> = [
    { value: "light", icon: Sun, label: tx.themeLight || "Light" },
    { value: "dark", icon: Moon, label: tx.themeDark || "Dark" },
    { value: "system", icon: Smartphone, label: tx.themeSystem || "System" },
  ];

  return (
    <PanelFrame
      icon={Palette}
      title={tx.appearance || "Appearance"}
      description={tx.navV2Theme || tx.theme || "Theme"}
      testId="settings-v2-panel-appearance"
    >
      <div
        className="grid gap-2 min-[520px]:grid-cols-3"
        role="group"
        aria-label={tx.themeLabel || "Theme"}
      >
        {themeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => changeTheme(option.value)}
              aria-pressed={theme === option.value}
              className={cn(
                "flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                theme === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.34)] text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <ToggleRow
        icon={Moon}
        title={tx.oledDarkMode || "OLED Dark Mode"}
        description={tx.oledDarkModeHint || "Pure black theme for OLED screens."}
        checked={oledMode}
        onCheckedChange={updateOled}
        testId="settings-v2-oled-toggle"
      />
    </PanelFrame>
  );
}

function LanguagePanel() {
  const { t, language, setLanguage } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  return (
    <PanelFrame
      icon={Globe2}
      title={tx.language || "Language"}
      description={tx.selectLanguage || "Choose language."}
      testId="settings-v2-panel-language"
    >
      <div
        className="grid gap-2 min-[520px]:grid-cols-2"
        role="group"
        aria-label={tx.language || "Language"}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            aria-pressed={language === lang}
            className={cn(
              "min-h-[48px] rounded-2xl border px-4 py-3 text-start text-sm font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              language === lang
                ? "border-primary bg-primary/10 text-primary"
                : "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.34)] text-foreground hover:bg-muted"
            )}
          >
            {languageNames[lang]}
          </button>
        ))}
      </div>
    </PanelFrame>
  );
}

function ModulesPanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { setFlag, isFeatureEnabled } = useFeatureFlags();

  return (
    <PanelFrame
      icon={LayoutGrid}
      title={tx.settingsGroupModules || "Modules"}
      description={tx.settingsModulesDescription || "Choose which tools stay visible."}
      testId="settings-v2-panel-modules"
    >
      {MODULES.map((module) => {
        const Icon = module.icon;
        const enabled = module.core ? true : isFeatureEnabled(module.feature as ToggleableFeature);
        const locked =
          module.feature === "focusTimer" ||
          module.feature === "quests" ||
          module.feature === "tasks" ||
          module.feature === "challenges"
            ? !isFeatureUnlocked(module.feature)
            : false;
        return (
          <ToggleRow
            key={module.id}
            icon={Icon}
            title={tx[module.titleKey] || module.id}
            description={
              locked
                ? tx.settingsModuleUnlockHint || "Unlock this from your progress."
                : tx[module.descriptionKey] || ""
            }
            checked={enabled && !locked}
            disabled={module.core || locked}
            onCheckedChange={(checked) => {
              if (module.feature) setFlag(module.feature, checked);
            }}
            testId={`settings-v2-module-${module.id}`}
          />
        );
      })}
    </PanelFrame>
  );
}

function NotificationsPanel({ controls }: { controls: V2SettingsControls }) {
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
        <div className="space-y-3 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-3">
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
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {tx.reminderDays || "Reminder days"}
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={tx.reminderDays || "Reminder days"}
            >
              {dayOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setReminder((prev) => ({
                      ...prev,
                      days: prev.days.includes(value)
                        ? prev.days.filter((day) => day !== value)
                        : [...prev.days, value].sort((a, b) => a - b),
                    }))
                  }
                  aria-pressed={controls.reminders.days.includes(value)}
                  className={cn(
                    "min-h-[44px] rounded-xl px-3 text-sm font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    controls.reminders.days.includes(value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
        <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {tx.notificationSound || "Notification sound"}
            </p>
          </div>
          <div className="grid gap-2 min-[520px]:grid-cols-2">
            {NOTIFICATION_SOUNDS.map((sound) => {
              const label = tx[sound.labelKey] || sound.id;
              return (
                <button
                  key={sound.id}
                  type="button"
                  onClick={() => updateSound(sound.id)}
                  aria-pressed={selectedSound === sound.id}
                  className={cn(
                    "min-h-[64px] rounded-2xl border p-3 text-start motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selectedSound === sound.id
                      ? "border-primary bg-primary/10"
                      : "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.48)] hover:bg-muted"
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {tx[`${sound.labelKey}Desc`] || sound.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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

function PrivacyPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [timeoutMs, setTimeoutMs] = useState(getStoredLockTimeoutMs);
  const privacyHref = `${BASE_URL}privacy.html`;
  const termsHref = `${BASE_URL}terms.html`;

  const updateTimeout = (ms: number) => {
    setTimeoutMs(ms);
    setAutoLockMs(ms);
  };

  return (
    <PanelFrame
      icon={Shield}
      title={tx.settingsGroupSecurity || tx.privacyTitle || "Privacy & security"}
      description={
        tx.settingsSecurityDesc || tx.privacyDescription || "Control privacy and journal lock."
      }
      testId="settings-v2-panel-privacy"
    >
      <ToggleRow
        icon={LockKeyhole}
        title={tx.privacyNoTracking || "No tracking"}
        description={tx.privacyNoTrackingHint || "Turn off analytics and ad personalization."}
        checked={controls.privacy.noTracking}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyNoTrackingPreference(prev, checked))
        }
        testId="settings-v2-no-tracking"
      />
      <ToggleRow
        icon={CheckCircle2}
        title={tx.privacyAnalytics || "Analytics"}
        description={tx.privacyAnalyticsHint || "Help improve ZenFlow with basic diagnostics."}
        checked={controls.privacy.analytics}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyAnalyticsPreference(prev, checked))
        }
        testId="settings-v2-analytics"
      />
      <ToggleRow
        icon={Shield}
        title={tx.privacyAds || "Personalized ads"}
        description={tx.privacyAdsHint || "Allow ad personalization where available."}
        checked={controls.privacy.adConsent === true}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyAdConsentPreference(prev, checked))
        }
        testId="settings-v2-ad-consent"
      />

      <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
        <label
          htmlFor="settings-v2-journal-lock"
          className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
          {tx.journalLockTimeout || "Journal auto-lock"}
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          {tx.journalLockTimeoutDesc || "Automatically lock journal after inactivity."}
        </p>
        <div className="relative">
          <select
            id="settings-v2-journal-lock"
            value={timeoutMs}
            onChange={(event) => updateTimeout(Number(event.target.value))}
            className="min-h-[48px] w-full appearance-none rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.58)] px-4 pe-11 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LOCK_TIMEOUT_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {tx[`lockTimeout_${option.ms}`] || option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <a
          className="text-primary underline hover:text-primary/90"
          href={privacyHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tx.privacyPolicy || "Privacy Policy"}
        </a>
        <a
          className="text-primary underline hover:text-primary/90"
          href={termsHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tx.termsOfService || "Terms of Service"}
        </a>
      </div>
    </PanelFrame>
  );
}

function DataPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const exp = useDataExport({
    setDataStatus,
    t: tx,
    moods: controls.moods ?? [],
    habits: controls.habits,
    focusSessions: controls.focusSessions ?? [],
    gratitudeEntries: controls.gratitudeEntries ?? [],
    userName: controls.userName,
  });
  const imp = useDataImport({ setDataStatus, t: tx });
  const { handleImportCancel, showImportConfirm } = imp;

  useBackHandler(showResetConfirm, () => setShowResetConfirm(false));
  useBackHandler(showImportConfirm, handleImportCancel);
  useScrollLock(showResetConfirm || showImportConfirm);

  useEffect(() => {
    if (!dataStatus) return;
    const timer = window.setTimeout(() => setDataStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [dataStatus]);

  useEffect(() => {
    if (!showResetConfirm && !showImportConfirm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (showImportConfirm) {
        handleImportCancel();
      } else {
        setShowResetConfirm(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleImportCancel, showImportConfirm, showResetConfirm]);

  const handleReset = async () => {
    setIsResettingData(true);
    setDataStatus(null);
    try {
      await controls.onResetData();
      setShowResetConfirm(false);
      setDataStatus(tx.resetDataSuccess || "Your local ZenFlow data has been reset.");
    } catch {
      setDataStatus(tx.resetDataError || "Data reset failed. Please try again.");
    } finally {
      setIsResettingData(false);
    }
  };

  return (
    <>
      <PanelFrame
        icon={DatabaseBackup}
        title={tx.settingsGroupData || tx.settingsSectionData || "Data"}
        description={tx.settingsExportDescription || "Export, import, and protect your data."}
        testId="settings-v2-panel-data"
      >
        <div className="grid gap-2 min-[520px]:grid-cols-3">
          <ActionButton
            icon={exp.isExporting ? Loader2 : FileJson}
            onClick={() => {
              void exp.handleExport();
            }}
            disabled={exp.isExporting}
            variant="primary"
            testId="settings-v2-export-json"
          >
            {exp.isExporting
              ? tx.exporting || "Exporting..."
              : tx.settingsExportTitle || tx.exportData || "Export"}
          </ActionButton>
          <ActionButton
            icon={exp.isExportingCSV ? Loader2 : FileSpreadsheet}
            onClick={exp.handleExportCSV}
            disabled={exp.isExportingCSV}
            testId="settings-v2-export-csv"
          >
            {tx.exportCSV || "CSV"}
          </ActionButton>
          <ActionButton
            icon={exp.isExportingPDF ? Loader2 : FileText}
            onClick={() => {
              void exp.handleExportPDF();
            }}
            disabled={exp.isExportingPDF}
            testId="settings-v2-export-pdf"
          >
            {tx.exportPDF || "PDF"}
          </ActionButton>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {tx.importMode || "Import mode"}
          </p>
          <div
            className="mb-3 grid gap-2 min-[420px]:grid-cols-2"
            role="group"
            aria-label={tx.importMode || "Import mode"}
          >
            {(["merge", "replace"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => imp.setImportMode(mode)}
                aria-pressed={imp.importMode === mode}
                className={cn(
                  "min-h-[44px] rounded-xl border px-3 text-sm font-semibold motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  imp.importMode === mode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.48)] text-foreground hover:bg-muted"
                )}
              >
                {mode === "merge" ? tx.importMerge || "Merge" : tx.importReplace || "Replace"}
              </button>
            ))}
          </div>
          <input
            ref={imp.fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={imp.handleImportFile}
          />
          <ActionButton
            icon={imp.isImporting ? Loader2 : Upload}
            onClick={imp.handleImportClick}
            disabled={imp.isImporting}
            testId="settings-v2-import"
          >
            {imp.isImporting
              ? tx.importing || "Importing..."
              : tx.settingsImportTitle || tx.importData || "Import"}
          </ActionButton>
        </div>

        <div role="status" aria-live="polite">
          {dataStatus && <p className="text-sm text-muted-foreground">{dataStatus}</p>}
        </div>

        {!showResetConfirm ? (
          <ActionButton
            icon={Trash2}
            variant="danger"
            onClick={() => setShowResetConfirm(true)}
            testId="settings-v2-reset-data"
          >
            {tx.resetAllData || "Reset all data"}
          </ActionButton>
        ) : (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
            <p className="mb-3 text-sm font-semibold text-destructive">
              {tx.areYouSure || "Are you sure?"} {tx.cannotBeUndone || "This cannot be undone."}
            </p>
            <div className="grid gap-2 min-[420px]:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResettingData}
                className="min-h-[44px] rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
              >
                {tx.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleReset();
                }}
                disabled={isResettingData}
                className="min-h-[44px] rounded-xl bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {isResettingData ? tx.resetting || "Resetting..." : tx.delete || "Delete"}
              </button>
            </div>
          </div>
        )}
      </PanelFrame>

      {imp.showImportConfirm && imp.pendingImportFile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-v2-import-title"
        >
          <button
            type="button"
            className="fixed inset-0 bg-background/70 backdrop-blur-md"
            aria-label={tx.cancel}
            onClick={imp.handleImportCancel}
          />
          <div className="relative w-full max-w-sm rounded-[1.5rem] border border-[hsl(var(--border)/0.58)] bg-card p-5 shadow-2xl">
            <h3 id="settings-v2-import-title" className="text-lg font-semibold text-foreground">
              {tx.importConfirmTitle || "Import Backup"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx.importConfirmMessage || "Import data from this file?"}
            </p>
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {imp.pendingImportFile.name}
            </p>
            <div className="mt-4 grid gap-2 min-[360px]:grid-cols-2">
              <button
                type="button"
                onClick={imp.handleImportCancel}
                className="min-h-[44px] rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
              >
                {tx.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void imp.handleImportConfirm();
                }}
                className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-primary-foreground zen-gradient"
              >
                {tx.settingsImportTitle || tx.importData || "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AccountPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const auth = useAccountAuth({ onNameChange: controls.onNameChange, t: tx });
  const sync = useAccountSync({
    sessionUserId: auth.sessionUserId,
    setAuthStatus: auth.setAuthStatus,
    t: tx,
  });
  const del = useDeleteAccount({ onResetData: controls.onResetData, t: tx });
  const { setShowDeleteConfirm, showDeleteConfirm } = del;
  const deleteAccountHref = `${BASE_URL}delete-account.html`;
  const linkedProviderLabels = auth.linkedProviderIds.map((providerId) =>
    getProviderName(tx, getAuthProviderConfig(providerId))
  );
  const linkableProviders = auth.enabledProviders.filter(
    (provider) => !auth.linkedProviderIds.includes(provider.id)
  );

  useBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false));
  useScrollLock(showDeleteConfirm);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setShowDeleteConfirm, showDeleteConfirm]);

  return (
    <PanelFrame
      icon={Cloud}
      title={tx.settingsCloudSyncTitle || tx.settingsGroupAccount || tx.account || "Account"}
      description={tx.settingsCloudSyncDescription || "Signed-in data stays synced automatically."}
      testId="settings-v2-panel-account"
    >
      <SyncHealthCard compact dense allowManualRetry={false} surface="settings-space" />

      {!supabase ? (
        <p className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4 text-sm text-muted-foreground">
          {tx.cloudSyncDisabled || "Cloud sync is not available."}
        </p>
      ) : auth.hasSession ? (
        <>
          <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
            <p className="text-sm text-muted-foreground">
              {tx.signedInAs || "Signed in as"}{" "}
              <span className="font-semibold text-foreground">
                {auth.sessionAccountLabel || auth.sessionDisplayName}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                {tx.weeklyDigestTitle || "Weekly Progress Report"}
              </p>
            </div>
            <ToggleRow
              icon={Mail}
              title={tx.weeklyDigestTitle || "Weekly Progress Report"}
              description={
                tx.weeklyDigestDescription ||
                "Receive a weekly summary of your habits, focus time, and mood trends."
              }
              checked={sync.weeklyDigestEnabled}
              disabled={sync.weeklyDigestLoading}
              onCheckedChange={(checked) => {
                sync.weeklyDigestTouchedRef.current = true;
                sync.setWeeklyDigestEnabled(checked);
                void sync.handleWeeklyDigestToggle(checked);
              }}
              testId="settings-v2-weekly-digest"
            />
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">
              {tx.authLinkedProviders || "Connected sign-in methods"}
            </p>
            {linkedProviderLabels.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {linkedProviderLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[hsl(var(--border)/0.55)] bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {linkableProviders.map((provider) => {
                const isLinking = auth.linkingProvider === provider.id;
                return (
                  <AuthProviderButton
                    key={provider.id}
                    provider={provider}
                    label={formatProviderText(tx, tx.authConnectProvider, provider)}
                    loadingLabel={formatProviderText(tx, tx.authLinkingProvider, provider)}
                    isLoading={isLinking}
                    disabled={auth.linkingProvider !== null}
                    onClick={() => {
                      void auth.handleLinkProvider(provider.id);
                    }}
                    surface="subtle"
                  />
                );
              })}
            </div>
          </div>

          <ActionButton
            icon={auth.isSigningOut ? Loader2 : UserRound}
            onClick={() => {
              void auth.handleSignOut();
            }}
            disabled={auth.isSigningOut}
          >
            {auth.isSigningOut ? tx.signingOut || "Signing out..." : tx.signOut || "Sign out"}
          </ActionButton>

          {!showDeleteConfirm ? (
            <ActionButton
              icon={Trash2}
              variant="danger"
              onClick={() => {
                del.setShowDeleteConfirm(true);
                del.setDeleteConfirmInput("");
              }}
            >
              {tx.deleteAccount || "Delete account"}
            </ActionButton>
          ) : (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-destructive">
                {tx.deleteAccountConfirm || "Delete your account?"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tx.deleteAccountWarning || "This action cannot be undone."}
              </p>
              <label className="mt-3 block text-xs font-semibold text-destructive">
                {tx.deleteAccountTypeConfirm || "Type DELETE to confirm:"}
              </label>
              <input
                type="text"
                value={del.deleteConfirmInput}
                onChange={(event) => del.setDeleteConfirmInput(event.target.value)}
                className="mt-2 min-h-[44px] w-full rounded-xl border border-destructive/20 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
              <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    del.setShowDeleteConfirm(false);
                    del.setDeleteConfirmInput("");
                  }}
                  className="min-h-[44px] rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
                >
                  {tx.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void del.handleDeleteAccount();
                  }}
                  disabled={
                    del.deleteConfirmInput !== (tx.deleteConfirmWord || "DELETE") ||
                    del.isDeletingAccount
                  }
                  className="min-h-[44px] rounded-xl bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {del.isDeletingAccount ? tx.deleting || "Deleting..." : tx.delete || "Delete"}
                </button>
              </div>
            </div>
          )}

          <a
            href={deleteAccountHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline hover:text-primary/90"
          >
            {tx.deleteAccountLink || "Learn about account deletion"}
          </a>
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
            <p className="text-sm font-semibold text-foreground">
              {tx.sessionExpiredSettings || "Sign in to sync automatically."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx.localDataSafe || "Your local data is safe."}
            </p>
          </div>
          {auth.enabledProviders.map((provider) => (
            <AuthProviderButton
              key={provider.id}
              provider={provider}
              label={tx[provider.labelKey] || provider.fallbackLabel}
              loadingLabel={tx[provider.loadingLabelKey] || provider.fallbackLoadingLabel}
              isLoading={auth.signingInProvider === provider.id}
              disabled={auth.isSigningIn}
              onClick={() => {
                void auth.handleProvider(provider.id);
              }}
              surface="subtle"
            />
          ))}
        </div>
      )}

      <div role="status" aria-live="polite">
        {auth.authStatus && <p className="text-sm text-muted-foreground">{auth.authStatus}</p>}
        {del.deleteStatus && <p className="text-sm text-muted-foreground">{del.deleteStatus}</p>}
      </div>

      <DeviceSessionsCard dense surface="settings" />
    </PanelFrame>
  );
}

function AboutPanel({ controls }: { controls: V2SettingsControls }) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const { toggleDemoMode } = useDemoMode();
  const { scale, setFontScale } = useFontScale();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | "licenses">("privacy");
  const [showDopamineSettings, setShowDopamineSettings] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    "idle" | "checking" | "available" | "latest" | "error"
  >("idle");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFontIndex = FONT_SCALE_LEVELS.indexOf(scale);

  useScrollLock(showFeedback || showChangelog || showLegal || showDopamineSettings);

  const handleVersionTap = () => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) {
      clearTimeout(versionTapTimer.current);
    }
    if (versionTapCount.current >= 5) {
      versionTapCount.current = 0;
      toggleDemoMode();
      return;
    }
    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
    }, 2000);
  };

  const handleCheckForUpdates = async () => {
    setUpdateCheckStatus("checking");
    setUpdateState(null);
    try {
      const result = await checkForAppUpdate();
      setUpdateState(result);
      setUpdateCheckStatus(result.available ? "available" : result.error ? "error" : "latest");
    } catch (error) {
      logger.error("[V2Settings] Update check failed:", error);
      setUpdateCheckStatus("error");
    }
  };

  return (
    <>
      <PanelFrame
        icon={Info}
        title={tx.settingsGroupAbout || "About"}
        description={`ZenFlow ${APP_VERSION}`}
        testId="settings-v2-panel-about"
      >
        <button
          type="button"
          onClick={handleVersionTap}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleVersionTap();
            }
          }}
          className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="block text-sm font-semibold text-foreground">
            {tx.appName || "ZenFlow"} v{APP_VERSION}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {tx.tagline || "Mood, habits, and journal in one calm flow."}
          </span>
        </button>

        {controls.onOpenWidgetSettings && (
          <ActionButton icon={Smartphone} onClick={controls.onOpenWidgetSettings}>
            {tx.widgetSettings || "Widget Settings"}
          </ActionButton>
        )}

        <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {tx.fontScaleTitle || "Text Size"}
            </p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {tx.fontScalePreviewSub || "Adjust text size across the app."}
          </p>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">A</span>
            <span className="text-sm font-semibold text-foreground">
              {tx[FONT_SCALE_LABELS[scale]] || `${Math.round(scale * 100)}%`}
            </span>
            <span className="text-xl text-muted-foreground">A</span>
          </div>
          <input
            type="range"
            min={0}
            max={FONT_SCALE_LEVELS.length - 1}
            step={1}
            value={currentFontIndex}
            onChange={(event) => setFontScale(FONT_SCALE_LEVELS[Number(event.target.value)])}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label={tx.fontScaleTitle || "Text Size"}
          />
        </div>

        <div className="grid gap-2 min-[520px]:grid-cols-2">
          <ActionButton icon={Sparkles} onClick={() => setShowDopamineSettings(true)}>
            {tx.dopamineSettings || "Feedback style"}
          </ActionButton>
          <ActionButton icon={History} onClick={() => setShowChangelog(true)}>
            {tx.changelogTitle || "Version History"}
          </ActionButton>
          <ActionButton icon={MessageSquare} onClick={() => setShowFeedback(true)}>
            {tx.sendFeedback || "Send feedback"}
          </ActionButton>
          <ActionButton
            icon={Shield}
            onClick={() => {
              setLegalTab("privacy");
              setShowLegal(true);
            }}
          >
            {tx.privacyPolicy || "Privacy Policy"}
          </ActionButton>
          <ActionButton
            icon={FileText}
            onClick={() => {
              setLegalTab("terms");
              setShowLegal(true);
            }}
          >
            {tx.termsOfService || "Terms of Service"}
          </ActionButton>
          <ActionButton
            icon={Scale}
            onClick={() => {
              setLegalTab("licenses");
              setShowLegal(true);
            }}
          >
            {tx.openSourceLicenses || "Open source licenses"}
          </ActionButton>
        </div>

        {isInstalled && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <p className="text-sm font-semibold text-foreground">
              {tx.appInstalled || "App installed"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx.appInstalledDescription || "ZenFlow is installed on this device."}
            </p>
          </div>
        )}

        {!isInstalled && canInstall && (
          <ActionButton
            icon={Download}
            variant="primary"
            onClick={() => {
              void promptInstall();
            }}
          >
            {tx.installNow || tx.installApp || "Install app"}
          </ActionButton>
        )}

        {isNative && (
          <div className="space-y-2 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.34)] p-4">
            <ActionButton
              icon={updateCheckStatus === "checking" ? Loader2 : RefreshCw}
              onClick={() => {
                void handleCheckForUpdates();
              }}
              disabled={updateCheckStatus === "checking"}
            >
              {updateCheckStatus === "checking"
                ? tx.checkingForUpdates || "Checking..."
                : tx.checkForUpdates || "Check for Updates"}
            </ActionButton>
            {updateCheckStatus === "latest" && (
              <p className="text-center text-xs text-muted-foreground">
                {tx.appUpToDate || "App is up to date"}
              </p>
            )}
            {updateCheckStatus === "available" && updateState && (
              <ActionButton
                icon={ExternalLink}
                variant="primary"
                onClick={() => {
                  void openGooglePlayStore();
                }}
              >
                {tx.openGooglePlay || "Open Google Play"}
              </ActionButton>
            )}
            {updateCheckStatus === "available" && updateState?.releaseNotes && (
              <p className="text-center text-xs text-muted-foreground">
                {typeof updateState.releaseNotes === "string"
                  ? updateState.releaseNotes
                  : updateState.releaseNotes[language] ||
                    updateState.releaseNotes.en ||
                    Object.values(updateState.releaseNotes)[0] ||
                    ""}
              </p>
            )}
            {updateCheckStatus === "error" && (
              <p className="text-center text-xs text-muted-foreground">
                {tx.updateCheckFailed || "Could not check for updates. Try again later."}
              </p>
            )}
          </div>
        )}
      </PanelFrame>

      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
      {showChangelog && <ChangelogPanel onClose={() => setShowChangelog(false)} />}
      <LegalModal open={showLegal} onOpenChange={setShowLegal} initialTab={legalTab} />
      {showDopamineSettings && (
        <DopamineSettingsComponent onClose={() => setShowDopamineSettings(false)} />
      )}
    </>
  );
}

export const V2SettingsControlDeck = memo(function V2SettingsControlDeck({
  controls,
  selectedSectionId,
}: V2SettingsControlDeckProps) {
  switch (selectedSectionId) {
    case "appearance":
      return <AppearancePanel />;
    case "language":
      return <LanguagePanel />;
    case "modules":
      return <ModulesPanel />;
    case "notifications":
      return <NotificationsPanel controls={controls} />;
    case "privacy":
      return <PrivacyPanel controls={controls} />;
    case "data":
      return <DataPanel controls={controls} />;
    case "account":
      return <AccountPanel controls={controls} />;
    case "about":
      return <AboutPanel controls={controls} />;
    case "profile":
    default:
      return <ProfilePanel controls={controls} />;
  }
});
