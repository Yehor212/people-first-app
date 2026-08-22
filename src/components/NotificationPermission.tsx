import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { isNative } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalClose } from "@/hooks/useModalState";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

interface NotificationPermissionProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function NotificationPermission({ onComplete, onCancel }: NotificationPermissionProps) {
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);
  useScrollLock(showPrompt);

  const handleDeny = useCallback(() => {
    storageSetRaw(SK.NOTIFICATION_PERMISSION_ASKED, "true");
    setShowPrompt(false);
    onComplete();
  }, [onComplete]);

  const handleBackCancel = useCallback(() => {
    setShowPrompt(false);
    onCancel();
  }, [onCancel]);

  const { modalProps } = useModalClose(showPrompt, handleBackCancel);

  useEffect(() => {
    void checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: check permission once
  }, []);

  const checkPermission = async () => {
    // Only show on native platforms
    if (!isNative) {
      onComplete();
      return;
    }

    // Check if we've already asked
    const hasAsked = storageGetRaw(SK.NOTIFICATION_PERMISSION_ASKED);
    if (hasAsked) {
      onComplete();
      return;
    }

    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === "granted") {
        storageSetRaw(SK.NOTIFICATION_PERMISSION_ASKED, "true");
        onComplete();
        return;
      }

      // Show the prompt
      setShowPrompt(true);
    } catch (error) {
      logger.error("[Notifications] Failed to check permissions:", error);
      onComplete();
    }
  };

  const handleAllow = async () => {
    try {
      const result = await LocalNotifications.requestPermissions();
      storageSetRaw(SK.NOTIFICATION_PERMISSION_ASKED, "true");

      if (result.display === "granted") {
        logger.log("[Notifications] Permission granted");
      }

      setShowPrompt(false);
      onComplete();
    } catch (error) {
      logger.error("[Notifications] Failed to request permissions:", error);
      setShowPrompt(false);
      onComplete();
    }
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <>
      {/* A11Y-OK: decorative backdrop overlay — aria-hidden removes from accessibility tree, no aria-label needed */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={handleDeny}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-background/95 ps-[max(0.5rem,var(--safe-inline-start))] pe-[max(0.5rem,var(--safe-inline-end))] pb-[calc(var(--safe-bottom)+0.5rem)] pt-[calc(var(--safe-top)+0.5rem)] backdrop-blur-sm motion-safe:animate-fade-in sm:ps-[max(1rem,var(--safe-inline-start))] sm:pe-[max(1rem,var(--safe-inline-end))] sm:pb-[calc(var(--safe-bottom)+1rem)] sm:pt-[calc(var(--safe-top)+1rem)] md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
      >
        <div
          {...modalProps}
          aria-labelledby="notification-permission-title"
          aria-label={t.ariaNotificationPermission}
          className="relative my-auto w-full max-w-md rounded-2xl bg-card p-4 zen-shadow-card motion-safe:animate-scale-in sm:p-6"
        >
          {/* Close button */}
          <button
            onClick={handleDeny}
            className="absolute end-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground motion-safe:transition-colors sm:end-4 sm:top-4"
            aria-label={t.close || "Close"}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-4 zen-gradient rounded-2xl zen-shadow-glow">
              <Bell className="w-12 h-12 text-primary-foreground" />
            </div>
          </div>

          {/* Title */}
          <h2 id="notification-permission-title" className="break-words text-2xl font-bold text-foreground text-center [hyphens:manual] [overflow-wrap:break-word] mb-2">
            {t.notificationPermissionTitle || "Stay on Track"}
          </h2>

          {/* Description */}
          <p className="break-words text-muted-foreground text-center [hyphens:manual] [overflow-wrap:break-word] mb-6">
            {t.notificationPermissionDescription ||
              "Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines."}
          </p>

          {/* Features */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 shrink-0 rounded-full bg-primary mt-2" />
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature1Title || "Daily Mood Reminders"}
                </p>
                <p className="break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature1Desc || "Check in with yourself every day"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 shrink-0 rounded-full bg-primary mt-2" />
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature2Title || "Habit Tracking"}
                </p>
                <p className="break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature2Desc || "Stay consistent with your goals"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 shrink-0 rounded-full bg-primary mt-2" />
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature3Title || "Focus Sessions"}
                </p>
                <p className="break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {t.notificationFeature3Desc || "Get reminded to take productive breaks"}
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleAllow}
              className="btn-press h-auto min-h-12 w-full min-w-0 whitespace-normal break-words rounded-xl py-3 font-semibold text-primary-foreground zen-gradient zen-shadow-soft [hyphens:manual] [overflow-wrap:break-word] hover:opacity-90 motion-safe:transition-opacity"
            >
              {t.notificationAllow || "Enable Notifications"}
            </button>
            <button
              onClick={handleDeny}
              className="btn-press h-auto min-h-12 w-full min-w-0 whitespace-normal break-words rounded-xl bg-secondary py-3 font-medium text-secondary-foreground [hyphens:manual] [overflow-wrap:break-word] hover:bg-muted motion-safe:transition-colors"
            >
              {t.notificationDeny || "Maybe Later"}
            </button>
          </div>

          {/* Privacy note */}
          <p className="break-words text-xs text-muted-foreground text-center [hyphens:manual] [overflow-wrap:break-word] mt-4">
            {t.notificationPrivacyNote ||
              "You can change this anytime in Settings. Notifications are local and private."}
          </p>
        </div>
      </div>
    </>
  );
}
