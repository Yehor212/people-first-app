import { useState } from "react";
import { FeedbackForm } from "@/components/FeedbackForm";
import { LegalModal } from "@/components/LegalModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { checkForAppUpdate, openGooglePlayStore, type UpdateState } from "@/lib/appUpdateManager";
import { getAppUpdateCapability } from "@/lib/appUpdateCapability";
import { APP_VERSION } from "@/lib/appVersion";
import { logger } from "@/lib/logger";
import { checkAppVersionStatus, reloadAppForUpdate } from "@/lib/versionCheck";

type LegalTab = "privacy" | "terms" | "licenses";
type UpdateCheckStatus = "idle" | "checking" | "available" | "latest" | "error";

const footerButtonBaseClass =
  "inline-flex min-h-11 min-w-0 max-w-full items-center justify-center whitespace-normal break-words rounded-[6px] px-3 text-sm font-semibold text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 motion-safe:transition-[transform,background-color,color] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.58)] motion-safe:active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55";
const footerButtonClass = `${footerButtonBaseClass} [hyphens:manual] [overflow-wrap:break-word]`;
const footerLegalLabelClass =
  "min-w-0 max-w-full whitespace-normal text-center [hyphens:manual] [overflow-wrap:break-word]";

export function SettingsSupportFooter() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const updateCapability = getAppUpdateCapability();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");
  const [updateCheckStatus, setUpdateCheckStatus] = useState<UpdateCheckStatus>("idle");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isRestartingUpdate, setIsRestartingUpdate] = useState(false);
  const [googlePlayOpenFailed, setGooglePlayOpenFailed] = useState(false);

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setShowLegal(true);
  };

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

  const handleRestartZenflow = async () => {
    setIsRestartingUpdate(true);
    try {
      if (!(await reloadAppForUpdate())) setIsRestartingUpdate(false);
    } catch (error) {
      logger.error("[V2Settings] Restart after update failed:", error);
      setIsRestartingUpdate(false);
      setUpdateCheckStatus("error");
    }
  };

  const updateStatus = googlePlayOpenFailed
    ? tx.openGooglePlayFailed || "Could not open Google Play. Try again."
    : updateCheckStatus === "checking"
      ? tx.checkingForUpdates || "Checking for updates…"
      : updateCheckStatus === "latest"
        ? tx.appUpToDate || "You have the latest version"
        : updateCheckStatus === "available"
          ? tx.webUpdateAvailable || tx.updateAvailable || "A newer version is ready"
          : updateCheckStatus === "error"
            ? tx.updateCheckFailed || "Could not check for updates"
            : isInstalled
              ? tx.appInstalled || "Installed"
              : null;

  return (
    <>
      <section
        aria-label={tx.settingsGroupHelpAbout || "Help and information"}
        className="border-t border-[hsl(var(--settings-v2-border)/0.3)] px-1 pt-3 text-center text-sm text-muted-foreground"
        data-testid="settings-support-footer"
      >
        <p className="text-xs font-medium text-muted-foreground">ZenFlow v{APP_VERSION}</p>
        <nav
          aria-label={tx.settingsAboutSupportLegalTitle || "Help and legal"}
          className="mt-1 flex flex-wrap items-center justify-center gap-1"
        >
          <button type="button" className={footerButtonClass} onClick={() => setShowFeedback(true)}>
            {tx.sendFeedback || "Send feedback"}
          </button>
          <button
            type="button"
            className={footerButtonBaseClass}
            data-slot="settings-footer-legal-action"
            onClick={() => openLegal("privacy")}
          >
            <span data-slot="settings-footer-legal-label" className={footerLegalLabelClass}>
              {tx.privacyPolicy || "Privacy"}
            </span>
          </button>
          <button
            type="button"
            className={footerButtonBaseClass}
            data-slot="settings-footer-legal-action"
            onClick={() => openLegal("terms")}
          >
            <span data-slot="settings-footer-legal-label" className={footerLegalLabelClass}>
              {tx.termsOfService || "Terms"}
            </span>
          </button>
          <button type="button" className={footerButtonClass} onClick={() => openLegal("licenses")}>
            {tx.openSourceLicenses || "Licenses"}
          </button>
          {!isInstalled && canInstall ? (
            <button
              type="button"
              className={footerButtonClass}
              onClick={() => void promptInstall()}
            >
              {tx.installNow || tx.installApp || "Install app"}
            </button>
          ) : null}
          {updateCapability.kind !== "unavailable" ? (
            <button
              type="button"
              className={footerButtonClass}
              disabled={updateCheckStatus === "checking" || isRestartingUpdate}
              onClick={() => void handleCheckForUpdates()}
              data-testid="settings-v2-check-updates"
            >
              {tx.checkForUpdates || "Check for updates"}
            </button>
          ) : null}
        </nav>

        {updateStatus ? (
          <p
            role={updateCheckStatus === "error" || googlePlayOpenFailed ? "alert" : "status"}
            className={
              updateCheckStatus === "error" || googlePlayOpenFailed
                ? "min-w-0 break-words pb-1 text-xs text-destructive [hyphens:manual] [overflow-wrap:break-word]"
                : "min-w-0 break-words pb-1 text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
            }
          >
            {updateStatus}
          </p>
        ) : null}

        {updateCheckStatus === "available" && updateCapability.kind === "web-reload" ? (
          <button
            type="button"
            className={footerButtonClass}
            disabled={isRestartingUpdate}
            onClick={() => void handleRestartZenflow()}
            data-testid="settings-v2-restart-update"
          >
            {isRestartingUpdate
              ? tx.restartingZenflow || "Restarting…"
              : tx.restartZenflow || "Restart ZenFlow"}
          </button>
        ) : null}

        {updateCheckStatus === "available" &&
        updateCapability.kind === "android-store" &&
        updateState ? (
          <button
            type="button"
            className={footerButtonClass}
            onClick={() => void handleOpenGooglePlayStore()}
          >
            {tx.openGooglePlay || "Open Google Play"}
          </button>
        ) : null}
      </section>

      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
      <LegalModal open={showLegal} onOpenChange={setShowLegal} initialTab={legalTab} />
    </>
  );
}
