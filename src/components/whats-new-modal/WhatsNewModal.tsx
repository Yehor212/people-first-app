/**
 * What's New Modal
 *
 * Shows changelog to users after app update.
 * Only displays once per version update.
 */

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { useBackHandler } from "@/hooks/useBackHandler";
import { APP_VERSION, wasAppUpdated } from "@/lib/appVersion";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { CHANGELOG } from "./changelog";

interface WhatsNewModalProps {
  onClose?: () => void;
}

export function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  const { t, language: _language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  // Add keyboard accessibility (escape, focus trap, focus restore)
  const { modalProps } = useModalKeyboard({
    isOpen: isVisible,
    onClose: () => {
      storageSetRaw(SK.LAST_SEEN_VERSION, APP_VERSION);
      setIsVisible(false);
      onClose?.();
      logger.log("[WhatsNew] Modal dismissed via keyboard");
    },
    closeOnEscape: true,
    trapFocus: true,
    restoreFocus: true,
  });

  useEffect(() => {
    // Check if we should show the modal
    const lastSeenVersion = storageGetRaw(SK.LAST_SEEN_VERSION);

    // Show if:
    // 1. App was updated (version changed from stored metadata)
    // 2. User hasn't seen this version's changelog
    if (wasAppUpdated() || lastSeenVersion !== APP_VERSION) {
      // Only show if we have changelog for this version
      if (CHANGELOG[APP_VERSION]) {
        setCurrentVersion(APP_VERSION);
        setIsVisible(true);
        logger.log("[WhatsNew] Showing modal for version:", APP_VERSION);
      } else {
        // No changelog for this version, mark as seen
        storageSetRaw(SK.LAST_SEEN_VERSION, APP_VERSION);
      }
    }
  }, []);

  // Android back button: dismiss modal
  useBackHandler(isVisible, () => {
    storageSetRaw(SK.LAST_SEEN_VERSION, APP_VERSION);
    setIsVisible(false);
    onClose?.();
    logger.log("[WhatsNew] Modal dismissed via back button");
  });

  const handleDismiss = () => {
    storageSetRaw(SK.LAST_SEEN_VERSION, APP_VERSION);
    setIsVisible(false);
    onClose?.();
    logger.log("[WhatsNew] Modal dismissed");
  };

  if (!isVisible || !currentVersion) return null;

  const changes = CHANGELOG[currentVersion] || [];

  // Get translated text or fallback to English
  const getText = (key: string, fallback: string): string => {
    // Try to get from translations using dot notation
    const keys = key.split(".");
    let value: unknown = t;
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return fallback;
      }
    }
    return typeof value === "string" ? value : fallback;
  };

  // A11Y-OK: backdrop is presentation-only; Escape bubbles from focused children inside the dialog
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleDismiss();
      }}
    >
      <div
        {...modalProps}
        aria-labelledby="whats-new-title"
        className={cn(
          "w-full max-w-md bg-card rounded-2xl shadow-2xl",
          "border border-border overflow-hidden",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
          <button
            onClick={handleDismiss}
            className="absolute top-4 end-4 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2
                id="whats-new-title"
                className="text-xl font-bold text-foreground"
              >
                {getText("whatsNew.title", "What's New")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {getText("whatsNew.version", "Version")} {currentVersion}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60dvh] overflow-y-auto">
          <div className="space-y-4">
            {changes.map((change, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl",
                  "bg-muted/50 hover:bg-muted transition-colors",
                )}
              >
                <div className="flex-shrink-0 p-2 rounded-lg bg-background">
                  {change.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {getText(change.titleKey, change.title)}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {getText(change.descriptionKey, change.description)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={handleDismiss}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-medium",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            )}
          >
            {getText("whatsNew.gotIt", "Got it!")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsNewModal;
