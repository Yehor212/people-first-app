import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  LockKeyhole,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/contexts/AdContext";
import { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "@/features/journal";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  applyAdConsentPreference,
  applyAnalyticsPreference,
  applyNoTrackingPreference,
  applyPushNotificationsPreference,
} from "@/lib/privacyConsent";
import { BASE_URL } from "@/lib/env";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { logger } from "@/lib/logger";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import { useDataImport } from "@/components/settings/data-section/useDataImport";
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
  SettingsSelectField,
  SettingsStatus,
  SettingsTextInput,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

function getStoredLockTimeoutMs(): number {
  return safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null) ?? 300_000;
}

export function PrivacyPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { privacyOptionsRequired, openAdPrivacyOptions } = useAds();
  const [timeoutMs, setTimeoutMs] = useState(getStoredLockTimeoutMs);
  const [isOpeningAdPrivacy, setIsOpeningAdPrivacy] = useState(false);
  const privacyHref = `${BASE_URL}privacy.html`;
  const termsHref = `${BASE_URL}terms.html`;

  const updateTimeout = (ms: number) => {
    setTimeoutMs(ms);
    setAutoLockMs(ms);
  };

  const handleOpenAdPrivacyOptions = async () => {
    if (isOpeningAdPrivacy) return;
    setIsOpeningAdPrivacy(true);
    try {
      await openAdPrivacyOptions();
    } finally {
      setIsOpeningAdPrivacy(false);
    }
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
        title={tx.privacyAds || "Rewarded ads"}
        description={
          tx.privacyAdsHint ||
          "Optional videos only. Ad requests stay off unless this is enabled; Google privacy choices may still appear when required."
        }
        checked={controls.privacy.adConsent === true}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyAdConsentPreference(prev, checked))
        }
        testId="settings-v2-ad-consent"
      />
      {privacyOptionsRequired && (
        <SettingsInset testId="settings-v2-ad-privacy-options">
          <SettingsFieldHeader
            icon={Shield}
            title={tx.adPrivacyOptions || "Google ad privacy choices"}
            description={
              tx.adPrivacyOptionsHint || "Change or withdraw Google ad consent where required."
            }
          />
          <SettingsInlineButton
            onClick={handleOpenAdPrivacyOptions}
            disabled={isOpeningAdPrivacy}
            isLoading={isOpeningAdPrivacy}
            testId="settings-v2-open-ad-privacy-options"
          >
            {tx.adPrivacyOptionsOpen || "Review ad choices"}
          </SettingsInlineButton>
        </SettingsInset>
      )}
      <ToggleRow
        icon={BellRing}
        title={tx.privacyPushNotifications || "Remote push notifications"}
        description={
          tx.privacyPushNotificationsHint ||
          "Register this device for account-based push reminders. Local reminders work without this."
        }
        checked={controls.privacy.pushNotifications === true}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyPushNotificationsPreference(prev, checked))
        }
        testId="settings-v2-push-notifications"
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

export function DataPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
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
  const resetConfirmWord = (tx.resetDataConfirmWord || "RESET").trim();
  const resetTypeLabel = (tx.resetDataTypeConfirm || "Type RESET to confirm").replace(
    "{word}",
    resetConfirmWord
  );
  const resetConfirmMatches = resetConfirmInput.trim() === resetConfirmWord;

  const closeResetConfirm = useCallback(() => {
    setShowResetConfirm(false);
    setResetConfirmInput("");
  }, []);

  useBackHandler(showResetConfirm, closeResetConfirm);
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
        closeResetConfirm();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeResetConfirm, handleImportCancel, showImportConfirm, showResetConfirm]);

  const handleReset = async () => {
    if (!resetConfirmMatches) return;
    setIsResettingData(true);
    setDataStatus(null);
    try {
      await controls.onResetData();
      closeResetConfirm();
      setDataStatus(tx.resetDataSuccess || "Your local ZenFlow data has been reset.");
    } catch (error) {
      logger.error("[V2Settings] Data reset failed", error);
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
            isLoading={exp.isExporting}
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
            isLoading={exp.isExportingCSV}
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
            isLoading={exp.isExportingPDF}
            testId="settings-v2-export-pdf"
          >
            {tx.exportPDF || "PDF"}
          </ActionButton>
        </SettingsButtonGrid>

        <SettingsInset>
          <SettingsFieldHeader title={tx.importMode || "Import mode"} />
          <SettingsButtonGrid
            columns="confirm"
            role="group"
            ariaLabel={tx.importMode || "Import mode"}
          >
            {(["merge", "replace"] as const).map((mode) => (
              <SettingsChoiceButton
                key={mode}
                onClick={() => imp.setImportMode(mode)}
                selected={imp.importMode === mode}
                presentation="compact"
                selectedTone={mode === "replace" ? "danger" : "subtle"}
                surface="card"
                testId={`settings-v2-import-mode-${mode}`}
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
            isLoading={imp.isImporting}
            variant={imp.importMode === "replace" ? "danger" : "secondary"}
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
            onClick={() => {
              setResetConfirmInput("");
              setShowResetConfirm(true);
            }}
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
              description={
                tx.resetDataScope ||
                "This removes local moods, habits, focus, gratitude, journal data, queues, and settings."
              }
            />
            <SettingsFieldHeader
              htmlFor="settings-v2-reset-confirm"
              tone="danger"
              title={resetTypeLabel}
            />
            <SettingsTextInput
              id="settings-v2-reset-confirm"
              value={resetConfirmInput}
              onChange={setResetConfirmInput}
              autoComplete="off"
              disabled={isResettingData}
              tone="danger"
            />
            <SettingsButtonGrid columns="confirm">
              <SettingsInlineButton onClick={closeResetConfirm} disabled={isResettingData}>
                {tx.cancel}
              </SettingsInlineButton>
              <SettingsInlineButton
                icon={isResettingData ? Loader2 : undefined}
                isLoading={isResettingData}
                onClick={() => {
                  void handleReset();
                }}
                disabled={isResettingData || !resetConfirmMatches}
                variant="danger"
              >
                {isResettingData
                  ? tx.resetting || "Resetting..."
                  : tx.resetDataConfirmAction || tx.resetAllData || "Reset data"}
              </SettingsInlineButton>
            </SettingsButtonGrid>
          </SettingsInset>
        )}
      </PanelFrame>

      {imp.showImportConfirm && imp.pendingImportFile && (
        <SettingsDialog
          titleId="settings-v2-import-title"
          title={tx.importConfirmTitle || "Import Backup"}
          description={
            imp.importMode === "replace"
              ? tx.settingsImportReplaceTooltip ||
                "All current data will be deleted and replaced with import"
              : tx.importConfirmMessage || "Import data from this file?"
          }
          detail={imp.pendingImportFile.name}
          cancelLabel={tx.cancel}
          confirmLabel={
            imp.importMode === "replace"
              ? tx.importReplace || "Replace"
              : tx.settingsImportTitle || tx.importData || "Import"
          }
          confirmVariant={imp.importMode === "replace" ? "danger" : "primary"}
          onCancel={imp.handleImportCancel}
          onConfirm={() => {
            void imp.handleImportConfirm();
          }}
        />
      )}
    </>
  );
}
