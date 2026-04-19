import { useState, useCallback } from "react";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bug, Lightbulb, HelpCircle, Send, Loader2, X } from "lucide-react";
import { APP_VERSION } from "@/lib/appVersion";
import { platform } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { submitDetailedFeedback } from "@/lib/feedbackService";
import { emailSchema } from "@/lib/validation";

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeedbackCategory = "bug" | "feature" | "other";

export const FeedbackForm = ({ open, onOpenChange }: FeedbackFormProps) => {
  const { t } = useLanguage();
  const closeFeedback = useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalA11y(open, closeFeedback);
  useScrollLock(open);

  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async () => {
    if (!message.trim() || status === "sending") return;

    // Validate email if provided
    if (email.trim()) {
      const emailValidation = emailSchema.safeParse(email.trim());
      if (!emailValidation.success) {
        setEmailError(t.feedbackInvalidEmail || "Invalid email format");
        return;
      }
    }
    setEmailError(null);

    setStatus("sending");

    try {
      // Collect device info
      const deviceInfo = {
        platform,
        appVersion: APP_VERSION,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
      };

      const feedbackData = {
        category,
        message: message.trim(),
        email: email.trim() || null,
        device_info: deviceInfo,
        app_version: APP_VERSION,
      };

      logger.log("[Feedback] Submitting:", feedbackData);

      // Always save to localStorage as backup first
      const saveToLocalStorage = () => {
        try {
          const stored = safeLocalStorageGet<Record<string, unknown>[]>(SK.FEEDBACK, []);
          stored.push({ ...feedbackData, created_at: new Date().toISOString() });
          safeLocalStorageSet(SK.FEEDBACK, stored.slice(-20));
          logger.log("[Feedback] Saved to localStorage backup");
        } catch (e) {
          logger.warn("[Feedback] Failed to save to localStorage:", e);
        }
      };

      // Try to send to Supabase, fall back to local storage
      const sent = await submitDetailedFeedback(feedbackData);
      if (!sent) {
        saveToLocalStorage();
      }

      // Always show success if we saved at least locally
      // Feedback is captured even if cloud sync failed
      setStatus("success");

      // Reset form after success
      setTimeout(() => {
        setMessage("");
        setEmail("");
        setCategory("bug");
        setStatus("idle");
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      logger.error("[Feedback] Failed to submit:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const throttledSubmit = useThrottledCallback(handleSubmit, 2000);

  if (!open) return null;

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close when clicking directly on the overlay (not children)
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleOverlayTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    // Only close when touching directly on the overlay (not children)
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const categories: { value: FeedbackCategory; icon: React.ReactNode; label: string }[] = [
    { value: "bug", icon: <Bug className="w-4 h-4" />, label: t.feedbackCategoryBug },
    { value: "feature", icon: <Lightbulb className="w-4 h-4" />, label: t.feedbackCategoryFeature },
    { value: "other", icon: <HelpCircle className="w-4 h-4" />, label: t.feedbackCategoryOther },
  ];

  return (
    <>
      {/* A11Y-OK: decorative backdrop — aria-hidden="true" removes from a11y tree, no aria-label needed */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/80 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center md:items-center md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        onMouseDown={handleOverlayMouseDown}
        onTouchEnd={handleOverlayTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-form-title"
      >
        <div
          className="w-full max-w-lg bg-background rounded-t-3xl p-6 max-h-[85dvh] overflow-y-auto motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300 pb-safe"
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2
                id="feedback-form-title"
                className="text-lg font-semibold flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5 text-primary" />
                {t.feedbackTitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t.feedbackSubtitle}</p>
            </div>
            <button
              onClick={handleClose}
              aria-label={t.close || "Close"}
              className="p-2 rounded-lg hover:bg-muted motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 pb-6">
            {/* Category Selection */}
            <div className="flex gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  aria-pressed={category === cat.value}
                  aria-label={cat.label}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium motion-safe:transition-all ${
                    category === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}
                >
                  {cat.icon}
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Message Input */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.feedbackMessagePlaceholder}
              aria-label={t.feedbackMessagePlaceholder || "Message"}
              className="w-full h-32 p-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={status === "sending"}
            />

            {/* Email Input (Optional) */}
            <div>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null); // Clear error when user types
                }}
                placeholder={t.feedbackEmailPlaceholder}
                aria-label={t.feedbackEmailPlaceholder || "Email (optional)"}
                autoComplete="email"
                className={`w-full p-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${
                  emailError
                    ? "ring-2 ring-red-500 focus-visible:ring-red-500"
                    : "focus-visible:ring-primary"
                }`}
                disabled={status === "sending"}
              />
              {emailError && <p className="text-sm text-red-500 mt-1">{emailError}</p>}
            </div>

            {/* Submit Button */}
            <Button
              onClick={throttledSubmit}
              disabled={!message.trim() || status === "sending"}
              className="w-full py-6 rounded-xl text-base font-semibold"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="w-5 h-5 me-2 motion-safe:animate-spin" aria-hidden="true" />
                  {t.feedbackSending}
                </>
              ) : status === "success" ? (
                t.feedbackSuccess
              ) : status === "error" ? (
                t.feedbackError
              ) : (
                <>
                  <Send className="w-5 h-5 me-2" />
                  {t.feedbackSubmit}
                </>
              )}
            </Button>

            {/* Version Info */}
            <p className="text-xs text-muted-foreground text-center">
              v{APP_VERSION} | {platform}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
