import { memo, useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
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
import { TimeInputInline } from "@/components/ui/time-input";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { safeLocalStorageGet, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { updateProfileName } from "@/lib/accountService";
import { userNameSchema } from "@/lib/validation";
import { Language, languageNames } from "@/i18n/translations";
import { setThemePreference } from "@/components/ThemeToggle";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import { useDataImport } from "@/components/settings/data-section/useDataImport";
import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { useAccountSync } from "@/components/settings/account-section/useAccountSync";
import { useDeleteAccount } from "@/components/settings/account-section/useDeleteAccount";
import { supabase } from "@/lib/supabaseClient";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsDialog,
  SettingsExternalLink,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsInsetButton,
  SettingsSelectField,
  SettingsStatus,
  SettingsTextInput,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls, V2SettingsSectionId } from "./types";

interface V2SettingsControlDeckProps {
  controls: V2SettingsControls;
  selectedSectionId: V2SettingsSectionId;
}

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

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

function syncLegacyThemePreference(theme: ThemePreference) {
  const oledEnabled = theme === "oled";
  storageSetRaw(SK.OLED_MODE, String(oledEnabled));
  document.documentElement.classList.toggle("oled", oledEnabled);

  if (theme === "paper") {
    setThemePreference("light");
  } else if (theme === "auto") {
    setThemePreference("system");
  } else {
    setThemePreference("dark");
  }
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
      title={tx.profile || tx.settingsGroupProfile || "Profile"}
      description={tx.yourName || "Name and personal preferences."}
      testId="settings-v2-panel-profile"
    >
      <SettingsFieldHeader htmlFor="settings-v2-name" title={tx.yourName || "Your name"} />
      <div className="flex flex-col gap-2 min-[520px]:flex-row">
        <SettingsTextInput
          id="settings-v2-name"
          value={name}
          onChange={setName}
          autoComplete="name"
          fill
        />
        <SettingsInlineButton
          onClick={() => {
            void handleNameSave();
          }}
          variant="primary"
        >
          {tx.save || "Save"}
        </SettingsInlineButton>
      </div>
      <div role="status" aria-live="polite">
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}

function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    syncLegacyThemePreference(theme);
  }, [appliedTheme, theme]);

  const updateTheme = (nextTheme: ThemePreference) => setTheme(nextTheme);

  const themeOptions: Array<{
    value: Exclude<ThemePreference, "oled">;
    icon: LucideIcon;
    label: string;
  }> = [
    { value: "paper", icon: Sun, label: tx.themeLight || "Light" },
    { value: "ink", icon: Moon, label: tx.themeDark || "Dark" },
    { value: "auto", icon: Smartphone, label: tx.themeSystem || "System" },
  ];

  return (
    <PanelFrame
      icon={Palette}
      title={tx.appearance || "Appearance"}
      description={tx.navV2Theme || tx.theme || "Theme"}
      testId="settings-v2-panel-appearance"
    >
      <SettingsButtonGrid columns="three" role="group" ariaLabel={tx.themeLabel || "Theme"}>
        {themeOptions.map((option) => (
          <SettingsChoiceButton
            key={option.value}
            icon={option.icon}
            selected={theme === option.value}
            onClick={() => updateTheme(option.value)}
            presentation="stacked"
            testId={`settings-v2-theme-choice-${option.value}`}
          >
            {option.label}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>

      <ToggleRow
        icon={Moon}
        title={tx.oledDarkMode || "OLED Dark Mode"}
        description={tx.oledDarkModeHint || "Pure black theme for OLED screens."}
        checked={theme === "oled"}
        onCheckedChange={(checked) => updateTheme(checked ? "oled" : "ink")}
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
      <SettingsButtonGrid columns="two" role="group" ariaLabel={tx.language || "Language"}>
        {LANGUAGES.map((lang) => (
          <SettingsChoiceButton
            key={lang}
            onClick={() => setLanguage(lang)}
            selected={language === lang}
          >
            {languageNames[lang]}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>
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
                  onClick={() => updateSound(sound.id)}
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

      <SettingsInset>
        <SettingsFieldHeader
          htmlFor="settings-v2-journal-lock"
          icon={Clock3}
          title={tx.journalLockTimeout || "Journal auto-lock"}
          description={tx.journalLockTimeoutDesc || "Automatically lock journal after inactivity."}
        />
        <SettingsSelectField
          id="settings-v2-journal-lock"
          value={timeoutMs}
          onChange={(value) => updateTimeout(Number(value))}
          options={LOCK_TIMEOUT_OPTIONS.map((option) => ({
            value: option.ms,
            label: tx[`lockTimeout_${option.ms}`] || option.label,
          }))}
        />
      </SettingsInset>

      <div className="flex flex-wrap gap-3 text-sm">
        <SettingsExternalLink href={privacyHref} size="sm">
          {tx.privacyPolicy || "Privacy Policy"}
        </SettingsExternalLink>
        <SettingsExternalLink href={termsHref} size="sm">
          {tx.termsOfService || "Terms of Service"}
        </SettingsExternalLink>
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
        <SettingsButtonGrid columns="three">
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
        </SettingsButtonGrid>

        <SettingsInset>
          <SettingsFieldHeader title={tx.importMode || "Import mode"} />
          <SettingsButtonGrid columns="confirm" role="group" ariaLabel={tx.importMode || "Import mode"}>
            {(["merge", "replace"] as const).map((mode) => (
              <SettingsChoiceButton
                key={mode}
                onClick={() => imp.setImportMode(mode)}
                selected={imp.importMode === mode}
                presentation="compact"
                surface="card"
              >
                {mode === "merge" ? tx.importMerge || "Merge" : tx.importReplace || "Replace"}
              </SettingsChoiceButton>
            ))}
          </SettingsButtonGrid>
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
        </SettingsInset>

        <div role="status" aria-live="polite">
          <SettingsStatus>{dataStatus}</SettingsStatus>
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
          <SettingsInset tone="danger">
            <SettingsFieldHeader
              tone="danger"
              title={`${tx.areYouSure || "Are you sure?"} ${
                tx.cannotBeUndone || "This cannot be undone."
              }`}
            />
            <SettingsButtonGrid columns="confirm">
              <SettingsInlineButton
                onClick={() => setShowResetConfirm(false)}
                disabled={isResettingData}
              >
                {tx.cancel}
              </SettingsInlineButton>
              <SettingsInlineButton
                onClick={() => {
                  void handleReset();
                }}
                disabled={isResettingData}
                variant="danger"
              >
                {isResettingData ? tx.resetting || "Resetting..." : tx.delete || "Delete"}
              </SettingsInlineButton>
            </SettingsButtonGrid>
          </SettingsInset>
        )}
      </PanelFrame>

      {imp.showImportConfirm && imp.pendingImportFile && (
        <SettingsDialog
          titleId="settings-v2-import-title"
          title={tx.importConfirmTitle || "Import Backup"}
          description={tx.importConfirmMessage || "Import data from this file?"}
          detail={imp.pendingImportFile.name}
          cancelLabel={tx.cancel}
          confirmLabel={tx.settingsImportTitle || tx.importData || "Import"}
          onCancel={imp.handleImportCancel}
          onConfirm={() => {
            void imp.handleImportConfirm();
          }}
        />
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
      showHeader={false}
    >
      {!supabase ? (
        <SettingsInset>
          <SettingsStatus>{tx.cloudSyncDisabled || "Cloud sync is not available."}</SettingsStatus>
        </SettingsInset>
      ) : auth.hasSession ? (
        <>
          <SettingsInset>
            <p className="text-sm text-muted-foreground">
              {tx.signedInAs || "Signed in as"}{" "}
              <span className="font-semibold text-foreground">
                {auth.sessionAccountLabel || auth.sessionDisplayName}
              </span>
            </p>
          </SettingsInset>

          <SettingsInset>
            <SettingsFieldHeader
              icon={Mail}
              title={tx.weeklyDigestTitle || "Weekly Progress Report"}
            />
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
          </SettingsInset>

          <SettingsInset>
            <SettingsFieldHeader title={tx.authLinkedProviders || "Connected sign-in methods"} />
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
          </SettingsInset>

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
            <SettingsInset tone="danger">
              <SettingsFieldHeader
                tone="danger"
                title={tx.deleteAccountConfirm || "Delete your account?"}
                description={tx.deleteAccountWarning || "This action cannot be undone."}
              />
              <SettingsFieldHeader
                htmlFor="settings-v2-delete-confirm"
                tone="danger"
                title={tx.deleteAccountTypeConfirm || "Type DELETE to confirm:"}
              />
              <SettingsTextInput
                id="settings-v2-delete-confirm"
                value={del.deleteConfirmInput}
                onChange={del.setDeleteConfirmInput}
                autoComplete="off"
                tone="danger"
              />
              <SettingsButtonGrid columns="confirm">
                <SettingsInlineButton
                  onClick={() => {
                    del.setShowDeleteConfirm(false);
                    del.setDeleteConfirmInput("");
                  }}
                >
                  {tx.cancel}
                </SettingsInlineButton>
                <SettingsInlineButton
                  onClick={() => {
                    void del.handleDeleteAccount();
                  }}
                  disabled={
                    del.deleteConfirmInput !== (tx.deleteConfirmWord || "DELETE") ||
                    del.isDeletingAccount
                  }
                  variant="danger"
                >
                  {del.isDeletingAccount ? tx.deleting || "Deleting..." : tx.delete || "Delete"}
                </SettingsInlineButton>
              </SettingsButtonGrid>
            </SettingsInset>
          )}

          <SettingsExternalLink href={deleteAccountHref}>
            {tx.deleteAccountLink || "Learn about account deletion"}
          </SettingsExternalLink>
        </>
      ) : (
        <div className="space-y-3">
          <SettingsInset>
            <p className="text-sm font-semibold text-foreground">
              {tx.sessionExpiredSettings || "Sign in to sync automatically."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx.localDataSafe || "Your local data is safe."}
            </p>
          </SettingsInset>
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
        <SettingsStatus>{auth.authStatus}</SettingsStatus>
        <SettingsStatus>{del.deleteStatus}</SettingsStatus>
      </div>
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
        <SettingsInsetButton
          onClick={handleVersionTap}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleVersionTap();
            }
          }}
        >
          <span className="block text-sm font-semibold text-foreground">
            {tx.appName || "ZenFlow"} v{APP_VERSION}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {tx.tagline || "Mood, habits, and journal in one calm flow."}
          </span>
        </SettingsInsetButton>

        {controls.onOpenWidgetSettings && (
          <ActionButton icon={Smartphone} onClick={controls.onOpenWidgetSettings}>
            {tx.widgetSettings || "Widget Settings"}
          </ActionButton>
        )}

        <SettingsInset>
          <SettingsFieldHeader
            icon={Type}
            title={tx.fontScaleTitle || "Text Size"}
            description={tx.fontScalePreviewSub || "Adjust text size across the app."}
          />
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
        </SettingsInset>

        <SettingsButtonGrid columns="two">
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
        </SettingsButtonGrid>

        {isInstalled && (
          <SettingsInset tone="success">
            <SettingsFieldHeader
              title={tx.appInstalled || "App installed"}
              description={tx.appInstalledDescription || "ZenFlow is installed on this device."}
            />
          </SettingsInset>
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
          <SettingsInset>
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
              <SettingsStatus center>
                {tx.appUpToDate || "App is up to date"}
              </SettingsStatus>
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
              <SettingsStatus center>
                {typeof updateState.releaseNotes === "string"
                  ? updateState.releaseNotes
                  : updateState.releaseNotes[language] ||
                    updateState.releaseNotes.en ||
                    Object.values(updateState.releaseNotes)[0] ||
                    ""}
              </SettingsStatus>
            )}
            {updateCheckStatus === "error" && (
              <SettingsStatus center>
                {tx.updateCheckFailed || "Could not check for updates. Try again later."}
              </SettingsStatus>
            )}
          </SettingsInset>
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
