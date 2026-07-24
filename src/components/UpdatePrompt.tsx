/**
 * Update Prompt Component
 * Shows a banner when a new app version is available on Google Play.
 * Uses IMMEDIATE mode for closed beta (blocking update required).
 *
 * Supports fallback mode when Google Play In-App Updates is unavailable:
 * - Shows "Open Google Play" button instead of in-app update
 * - Displays version info from Supabase
 */

import { useState } from "react";
import { Download, X, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  startAppUpdate,
  UpdateState,
  dismissUpdate,
  openGooglePlayStore,
} from "@/lib/appUpdateManager";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";

interface UpdatePromptProps {
  /** Update state from checkForAppUpdate() */
  updateState: UpdateState;
  /** Callback when update is dismissed (non-critical only) */
  onDismiss: () => void;
}

export function UpdatePrompt({ updateState, onDismiss }: UpdatePromptProps) {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  // Don't show if no update or not checked yet
  if (!updateState.available || !updateState.checked) return null;

  // Critical/high priority = can't dismiss (must update)
  const isCritical = updateState.priority === "critical" || updateState.priority === "high";

  // Using fallback mode (Supabase check instead of Google Play In-App Updates)
  const useFallback = updateState.useFallback ?? false;

  const handleUpdate = async () => {
    void haptics.buttonPress();
    setIsLoading(true);

    try {
      if (useFallback) {
        // Fallback: Open Google Play Store directly
        await openGooglePlayStore();
      } else {
        // Standard: Use Google Play In-App Updates
        const success = await startAppUpdate(true);
        if (!success) {
          // In-App Update failed — fall back to Play Store directly
          logger.warn("[UpdatePrompt] In-app update failed, opening Play Store");
          await openGooglePlayStore();
        }
      }
    } catch (error) {
      // Last resort: open Play Store directly
      logger.error("[UpdatePrompt] Update failed:", error);
      await openGooglePlayStore();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    void haptics.buttonPress();
    dismissUpdate();
    onDismiss();
  };

  // Translations with fallbacks
  const title = t.updateAvailable || "Update Available";

  // Build description based on mode and priority
  let description: string;
  if (isCritical) {
    description =
      t.updateDescriptionCritical || "A critical update is required to continue using the app.";
  } else if (useFallback && updateState.latestVersion) {
    description = (
      t.updateDescriptionVersion || "Version {version} is available with improvements and fixes."
    ).replace("{version}", updateState.latestVersion);
  } else {
    description =
      t.updateDescription || "A new version is ready to install with improvements and fixes.";
  }

  // Button text depends on mode
  const buttonText = useFallback
    ? t.openGooglePlay || "Open Google Play"
    : t.updateNow || "Update Now";

  const ButtonIcon = useFallback ? ExternalLink : Download;

  return (
    <div
      className="fixed inset-x-4 top-4 z-[250] motion-safe:animate-slide-down"
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      <div className="max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-gradient-to-r from-primary to-primary/90 p-4 text-primary-foreground shadow-lg">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-primary-foreground/20 p-2">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="break-words text-lg font-semibold">
              {title}
              {updateState.latestVersion && (
                <span className="ms-2 inline-block break-words text-sm opacity-80">
                  v{updateState.latestVersion}
                </span>
              )}
            </h3>
            <p className="mt-0.5 break-words text-sm opacity-90">{description}</p>
            {/* Show release notes if available */}
            {updateState.releaseNotes && (
              <p className="mt-1 break-words text-xs opacity-70">
                {typeof updateState.releaseNotes === "string"
                  ? updateState.releaseNotes
                  : updateState.releaseNotes[language] || updateState.releaseNotes.en || ""}
              </p>
            )}
          </div>
          {/* Only show dismiss button for non-critical updates */}
          {!isCritical && (
            <button
              onClick={handleDismiss}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-1.5 motion-safe:transition-colors hover:bg-primary-foreground/20"
              aria-label={t.dismiss}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <button
          onClick={handleUpdate}
          disabled={isLoading}
          className="mt-3 flex h-auto min-h-11 w-full items-center justify-center gap-2 whitespace-normal break-words rounded-xl bg-primary-foreground/20 px-3 py-2.5 text-center font-medium motion-safe:transition-colors hover:bg-primary-foreground/30 disabled:opacity-50"
        >
          <ButtonIcon
            className={`h-4 w-4 shrink-0 ${isLoading ? "motion-safe:animate-pulse" : ""}`}
          />
          {isLoading ? t.loading || "Loading..." : buttonText}
        </button>

        {/* Show staleness info for old updates (only for non-fallback mode) */}
        {!useFallback && updateState.stalenessDays > 0 && (
          <p className="mt-2 break-words text-center text-xs opacity-70">
            {t.updateAvailableFor?.replace("{days}", String(updateState.stalenessDays)) ||
              `Available for ${updateState.stalenessDays} days`}
          </p>
        )}
      </div>
    </div>
  );
}
