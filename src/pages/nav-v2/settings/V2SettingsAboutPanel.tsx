import { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  History,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Type,
} from "lucide-react";
import { ChangelogPanel } from "@/components/ChangelogPanel";
import { DopamineSettingsComponent } from "@/components/DopamineSettings";
import { FeedbackForm } from "@/components/FeedbackForm";
import { LegalModal } from "@/components/LegalModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDemoMode } from "@/hooks/useDemoMode";
import { FONT_SCALE_LEVELS, useFontScale } from "@/hooks/useFontScale";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useScrollLock } from "@/hooks/useScrollLock";
import { checkForAppUpdate, openGooglePlayStore, type UpdateState } from "@/lib/appUpdateManager";
import { APP_VERSION } from "@/lib/appVersion";
import { logger } from "@/lib/logger";
import { isNative } from "@/lib/platform";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsFieldHeader,
  SettingsInset,
  SettingsInsetButton,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";

const FONT_SCALE_LABELS: Record<number, string> = {
  0.85: "fontScaleTiny",
  0.9: "fontScaleSmall",
  1: "fontScaleDefault",
  1.1: "fontScaleMedium",
  1.2: "fontScaleLarge",
  1.3: "fontScaleXL",
  1.5: "fontScaleXXL",
};

export function AboutPanel() {
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

        <div className="space-y-3" data-testid="settings-v2-about-experience-group">
          <SettingsFieldHeader
            icon={Sparkles}
            title={tx.settingsAboutExperienceTitle || "Experience controls"}
            description={
              tx.settingsAboutExperienceDescription ||
              "Motion preferences, release notes, and app feedback live together."
            }
          />
          <SettingsButtonGrid columns="two">
            <ActionButton icon={Sparkles} onClick={() => setShowDopamineSettings(true)}>
              {tx.dopamineSettings || "Feedback style"}
            </ActionButton>
            <ActionButton icon={History} onClick={() => setShowChangelog(true)}>
              {tx.changelogTitle || "Version History"}
            </ActionButton>
          </SettingsButtonGrid>
        </div>

        <div className="space-y-3" data-testid="settings-v2-about-support-legal-group">
          <SettingsFieldHeader
            icon={Shield}
            title={tx.settingsAboutSupportLegalTitle || "Support and legal"}
            description={
              tx.settingsAboutSupportLegalDescription ||
              "Privacy, terms, licenses, and contact options."
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
              {tx.openSourceLicenses || "Open source licenses"}
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
