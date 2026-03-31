import { useState, useRef } from "react";
import {
  Sparkles,
  History,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Shield,
  FileText,
  Scale,
} from "lucide-react";
import { isNative } from "@/lib/platform";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  checkForAppUpdate,
  openGooglePlayStore,
  UpdateState,
} from "@/lib/appUpdateManager";
import { APP_VERSION } from "@/lib/appVersion";
import { FeedbackForm } from "@/components/FeedbackForm";
import { ChangelogPanel } from "@/components/ChangelogPanel";
import { LegalModal } from "@/components/LegalModal";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useScrollLock } from "@/hooks/useScrollLock";

export function AboutSection() {
  const { t, language } = useLanguage();

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<"privacy" | "terms" | "licenses">(
    "privacy",
  );
  useScrollLock(showFeedback || showChangelog || showLegal);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    "idle" | "checking" | "available" | "latest" | "error"
  >("idle");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  const { toggleDemoMode } = useDemoMode();
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      if (result.available) {
        setUpdateCheckStatus("available");
      } else if (result.error) {
        setUpdateCheckStatus("error");
      } else {
        setUpdateCheckStatus("latest");
      }
    } catch (error) {
      logger.error("[Settings] Update check failed:", error);
      setUpdateCheckStatus("error");
    }
  };

  const handleOpenGooglePlay = async () => {
    await openGooglePlayStore();
  };

  return (
    <>
      <AccordionItem
        value="about"
        className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden"
      >
        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 zen-gradient rounded-xl shadow-zen-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">
              {t.settingsGroupAbout}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            {/* Version Info */}
            <div className="text-center text-muted-foreground py-2">
              <p
                role="button" // eslint-disable-line jsx-a11y/no-noninteractive-element-to-interactive-role -- version tap easter egg
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleVersionTap();
                  }
                }}
                className="text-sm font-medium text-foreground select-none cursor-default"
                onClick={handleVersionTap}
              >
                {t.appName} v{APP_VERSION}
              </p>
              <p className="text-xs mt-1">{t.tagline}</p>
            </div>

            {/* Version History Button */}
            <button
              onClick={() => setShowChangelog(true)}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <History className="w-4 h-4" />
              {t.changelogTitle || "Version History"}
            </button>

            {/* Check for Updates Button - Only on native */}
            {isNative && (
              <div className="space-y-3">
                <button
                  onClick={handleCheckForUpdates}
                  disabled={updateCheckStatus === "checking"}
                  className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${updateCheckStatus === "checking" ? "motion-safe:animate-spin" : ""}`}
                  />
                  {updateCheckStatus === "checking"
                    ? t.checkingForUpdates || "Checking..."
                    : t.checkForUpdates || "Check for Updates"}
                </button>

                {/* Update Status Messages */}
                {updateCheckStatus === "latest" && (
                  <p className="text-sm text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {t.appUpToDate || "App is up to date"}
                  </p>
                )}

                {updateCheckStatus === "available" && updateState && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-sm font-medium text-foreground text-center mb-2">
                      {t.updateAvailable || "Update Available"}
                      {updateState.latestVersion && (
                        <span className="text-primary ms-1">
                          v{updateState.latestVersion}
                        </span>
                      )}
                    </p>
                    {updateState.releaseNotes && (
                      <p className="text-xs text-muted-foreground text-center mb-2">
                        {typeof updateState.releaseNotes === "string"
                          ? updateState.releaseNotes
                          : updateState.releaseNotes[language] ||
                            updateState.releaseNotes["en"] ||
                            Object.values(updateState.releaseNotes)[0] ||
                            ""}
                      </p>
                    )}
                    <button
                      onClick={handleOpenGooglePlay}
                      className="w-full py-2 min-h-[44px] zen-gradient text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.openGooglePlay || "Open Google Play"}
                    </button>
                  </div>
                )}

                {updateCheckStatus === "error" && (
                  <p className="text-sm text-center text-muted-foreground">
                    {t.updateCheckFailed ||
                      "Could not check for updates. Try again later."}
                  </p>
                )}
              </div>
            )}

            {/* Feedback Button */}
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="font-medium">{t.sendFeedback}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
            </button>

            {/* Legal Buttons */}
            <button
              onClick={() => {
                setLegalTab("privacy");
                setShowLegal(true);
              }}
              className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-medium">{t.privacyPolicy}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
            </button>

            <button
              onClick={() => {
                setLegalTab("terms");
                setShowLegal(true);
              }}
              className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-medium">{t.termsOfService}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
            </button>

            <button
              onClick={() => {
                setLegalTab("licenses");
                setShowLegal(true);
              }}
              className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-primary" />
                <span className="font-medium">{t.openSourceLicenses}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground rtl:scale-x-[-1]" />
            </button>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Modals */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
      {showChangelog && (
        <ChangelogPanel onClose={() => setShowChangelog(false)} />
      )}
      <LegalModal
        open={showLegal}
        onOpenChange={setShowLegal}
        initialTab={legalTab}
      />
    </>
  );
}
