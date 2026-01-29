/**
 * Update Prompt Component
 * Shows a banner when a new app version is available on Google Play.
 * Uses IMMEDIATE mode for closed beta (blocking update required).
 *
 * Supports fallback mode when Google Play In-App Updates is unavailable:
 * - Shows "Open Google Play" button instead of in-app update
 * - Displays version info from Supabase
 */

import { useState } from 'react';
import { Download, X, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { startAppUpdate, UpdateState, dismissUpdate, openGooglePlayStore } from '@/lib/appUpdateManager';
import { haptics } from '@/lib/haptics';

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
  const isCritical = updateState.priority === 'critical' || updateState.priority === 'high';

  // Using fallback mode (Supabase check instead of Google Play In-App Updates)
  const useFallback = updateState.useFallback ?? false;

  const handleUpdate = async () => {
    haptics.buttonPress();
    setIsLoading(true);

    try {
      if (useFallback) {
        // Fallback: Open Google Play Store directly
        await openGooglePlayStore();
      } else {
        // Standard: Use Google Play In-App Updates
        await startAppUpdate(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    haptics.buttonPress();
    dismissUpdate();
    onDismiss();
  };

  // Translations with fallbacks
  const title = t.updateAvailable || 'Update Available';

  // Build description based on mode and priority
  let description: string;
  if (isCritical) {
    description = t.updateDescriptionCritical || 'A critical update is required to continue using the app.';
  } else if (useFallback && updateState.latestVersion) {
    description = (t.updateDescriptionVersion || 'Version {version} is available with improvements and fixes.')
      .replace('{version}', updateState.latestVersion);
  } else {
    description = t.updateDescription || 'A new version is ready to install with improvements and fixes.';
  }

  // Button text depends on mode
  const buttonText = useFallback
    ? (t.openGooglePlay || 'Open Google Play')
    : (t.updateNow || 'Update Now');

  const ButtonIcon = useFallback ? ExternalLink : Download;

  return (
    <div className="fixed inset-x-4 top-4 z-[200] animate-slide-down" style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">
              {title}
              {updateState.latestVersion && (
                <span className="text-sm opacity-80 ml-2">v{updateState.latestVersion}</span>
              )}
            </h3>
            <p className="text-sm opacity-90 mt-0.5">
              {description}
            </p>
            {/* Show release notes if available */}
            {updateState.releaseNotes && (
              <p className="text-xs opacity-70 mt-1 line-clamp-2">
                {typeof updateState.releaseNotes === 'string'
                  ? updateState.releaseNotes
                  : (updateState.releaseNotes as Record<string, string>)[language]
                    || (updateState.releaseNotes as Record<string, string>).en
                    || ''}
              </p>
            )}
          </div>
          {/* Only show dismiss button for non-critical updates */}
          {!isCritical && (
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <button
          onClick={handleUpdate}
          disabled={isLoading}
          className="mt-3 w-full py-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <ButtonIcon className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} />
          {isLoading ? (t.loading || 'Loading...') : buttonText}
        </button>

        {/* Show staleness info for old updates (only for non-fallback mode) */}
        {!useFallback && updateState.stalenessDays > 0 && (
          <p className="text-xs text-center opacity-70 mt-2">
            {t.updateAvailableFor?.replace('{days}', String(updateState.stalenessDays)) ||
              `Available for ${updateState.stalenessDays} days`}
          </p>
        )}
      </div>
    </div>
  );
}
