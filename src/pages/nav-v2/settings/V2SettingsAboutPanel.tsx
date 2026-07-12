import { useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
} from "lucide-react";
import { FeedbackForm } from "@/components/FeedbackForm";
import { LegalModal } from "@/components/LegalModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { checkForAppUpdate, openGooglePlayStore, type UpdateState } from "@/lib/appUpdateManager";
import { getAppUpdateCapability } from "@/lib/appUpdateCapability";
import { APP_VERSION } from "@/lib/appVersion";
import { checkAppVersionStatus, reloadAppForUpdate } from "@/lib/versionCheck";
import { logger } from "@/lib/logger";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";

export function AboutPanel() {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const updateCapability = getAppUpdateCapability();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | "licenses">("privacy");
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    "idle" | "checking" | "available" | "latest" | "error"
  >("idle");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isRestartingUpdate, setIsRestartingUpdate] = useState(false);
  const [googlePlayOpenFailed, setGooglePlayOpenFailed] = useState(false);

  const handleCheckForUpdates = async () => {
    setUpdateCheckStatus("checking");
    setUpdateState(null);
    setGooglePlayOpenFailed(false);
    try {
      if (updateCapability.kind === "android-store") {
        const result = await checkForAppUpdate();
        setUpdateState(result);
        setUpdateCheckStatus(result.available ? "available" : result.error ? "error" : "latest");
        return;
      }

      if (updateCapability.kind !== "web-reload") return;
      const result = await checkAppVersionStatus();
      setUpdateCheckStatus(
        result.status === "stale" ? "available" : result.status === "current" ? "latest" : "error"
      );
    } catch (error) {
      logger.error("[V2Settings] Update check failed:", error);
      setUpdateCheckStatus("error");
    }
  };

  const handleOpenGooglePlayStore = async () => {
    setGooglePlayOpenFailed(false);
    try {
      const opened = await openGooglePlayStore();
      if (!opened) setGooglePlayOpenFailed(true);
    } catch (error) {
      logger.error("[V2Settings] Could not open Google Play:", error);
      setGooglePlayOpenFailed(true);
    }
  };

  const handleRestartZenflow = () => {
    setIsRestartingUpdate(true);
    try {
      const didStartReload = reloadAppForUpdate();
      if (!didStartReload) {
        setIsRestartingUpdate(false);
      }
    } catch (error) {
      logger.error("[V2Settings] Restart after update failed:", error);
      setIsRestartingUpdate(false);
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
        <div className="w-full rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-shell)/0.56)] p-4 text-center shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)]">
          <span className="block text-sm font-semibold text-foreground">
            {tx.appName || "ZenFlow"} v{APP_VERSION}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {tx.settingsAboutProductSummary ||
              "ZenFlow brings mood check-ins, habits, focus sessions, and your journal into one place."}
          </span>
        </div>

        <div className="space-y-3" data-testid="settings-v2-about-support-legal-group">
          <SettingsFieldHeader
            icon={Shield}
            title={tx.settingsAboutSupportLegalTitle || "Help and legal"}
            description={
              tx.settingsAboutSupportLegalDescription ||
              "Privacy, terms, licenses, and support."
            }
          />
          <SettingsButtonGrid columns="two">
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
              {tx.openSourceLicenses || "Licenses"}
            </ActionButton>
          </SettingsButtonGrid>
        </div>

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

        {updateCapability.kind !== "unavailable" && (
        <SettingsInset testId="settings-v2-update-check">
          <SettingsFieldHeader
            icon={RefreshCw}
            title={tx.settingsUpdateTitle || "App version"}
            description={
              updateCapability.kind === "android-store"
                ? tx.settingsNativeUpdateDescription || "Check for a newer version."
                : tx.settingsWebUpdateDescription || "Check for a newer version."
            }
          />
          <ActionButton
            icon={updateCheckStatus === "checking" ? Loader2 : RefreshCw}
            onClick={() => {
              void handleCheckForUpdates();
            }}
            disabled={updateCheckStatus === "checking" || isRestartingUpdate}
            isLoading={updateCheckStatus === "checking"}
            testId="settings-v2-check-updates"
          >
            {updateCheckStatus === "checking"
              ? tx.checkingForUpdates || "Checking for updates..."
              : tx.checkForUpdates || "Check for updates"}
          </ActionButton>
          {updateCheckStatus === "latest" && (
            <SettingsStatus center ariaLabel={tx.appUpToDate || "You have the latest version"}>
              {tx.appUpToDate || "You have the latest version"}
            </SettingsStatus>
          )}
          {updateCheckStatus === "available" && updateCapability.kind === "web-reload" && (
            <SettingsStatus
              center
              ariaLabel={
                (tx.webUpdateAvailable || "A newer version is ready") +
                ". " +
                (tx.webUpdateAvailableDescription ||
                  "Restart ZenFlow to load the latest version. Finish anything you are typing first.")
              }
            >
              <span className="block font-semibold text-foreground">
                {tx.webUpdateAvailable || "A newer version is ready"}
              </span>
              <span className="mt-1 block">
                {tx.webUpdateAvailableDescription ||
                  "Restart ZenFlow to load the latest version. Finish anything you are typing first."}
              </span>
            </SettingsStatus>
          )}
          {updateCheckStatus === "available" && updateCapability.kind === "web-reload" && (
            <ActionButton
              icon={isRestartingUpdate ? Loader2 : RefreshCw}
              variant="primary"
              onClick={() => {
                handleRestartZenflow();
              }}
              disabled={isRestartingUpdate}
              isLoading={isRestartingUpdate}
              testId="settings-v2-restart-update"
            >
              {isRestartingUpdate
                ? tx.restartingZenflow || "Restarting..."
                : tx.restartZenflow || "Restart ZenFlow"}
            </ActionButton>
          )}
          {updateCheckStatus === "available" && updateCapability.kind === "android-store" && updateState && (
            <ActionButton
              icon={ExternalLink}
              variant="primary"
              onClick={() => {
                void handleOpenGooglePlayStore();
              }}
            >
              {tx.openGooglePlay || "Open Google Play"}
            </ActionButton>
          )}
          {googlePlayOpenFailed && (
            <p role="alert" className="text-center text-sm text-destructive">
              {tx.openGooglePlayFailed || "Could not open Google Play. Try again."}
            </p>
          )}
          {updateCheckStatus === "available" && updateCapability.kind === "android-store" && updateState?.releaseNotes && (
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
            <SettingsStatus
              center
              tone="danger"
              ariaLabel={
                updateCapability.kind === "android-store"
                  ? tx.updateCheckFailed || "Could not check for updates"
                  : (tx.updateCheckFailed || "Could not check for updates") +
                    ". " +
                    (tx.webUpdateCheckFailedDescription ||
                      "ZenFlow needs a network check to confirm the latest version. Nothing changed on this device.")
              }
            >
              <span className="block font-semibold">
                {tx.updateCheckFailed || "Could not check for updates"}
              </span>
              {updateCapability.kind === "web-reload" ? (
                <span className="mt-1 block">
                  {tx.webUpdateCheckFailedDescription ||
                    "ZenFlow needs a network check to confirm the latest version. Nothing changed on this device."}
                </span>
              ) : null}
            </SettingsStatus>
          )}
        </SettingsInset>
        )}
      </PanelFrame>

      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
      <LegalModal open={showLegal} onOpenChange={setShowLegal} initialTab={legalTab} />
    </>
  );
}
