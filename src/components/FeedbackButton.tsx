/**
 * Feedback Button Component
 *
 * Floating button that opens a feedback form.
 * Submits feedback to the configured service and keeps the draft visible on failure.
 */

import { useId, useState } from "react";
import { MessageSquarePlus, Send, X, Bug, Lightbulb, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { submitQuickFeedback } from "@/lib/feedbackService";
import { platform } from "@/lib/platform";
import { haptics } from "@/lib/haptics";
import { useModalState } from "@/hooks/useModalState";

import { logger } from "@/lib/logger";

type FeedbackType = "bug" | "feature" | "other";

interface FeedbackButtonProps {
  /** Position of the button */
  position?: "bottom-right" | "bottom-left";
  /** Custom className */
  className?: string;
}

export function FeedbackButton({ position = "bottom-right", className }: FeedbackButtonProps) {
  const { t } = useLanguage();
  const feedbackMessageId = useId();
  const feedbackMessageLabel = t.feedbackPlaceholder || "Describe your feedback...";
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryFailed, setDeliveryFailed] = useState(false);

  const { isOpen, open, close } = useModalState({
    onClose: () => {
      void haptics.light();
      setMessage("");
      setType("bug");
      setDeliveryFailed(false);
    },
  });

  const handleOpen = () => {
    void haptics.light();
    open();
  };

  const handleClose = () => {
    close();
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    void haptics.medium();
    setIsSubmitting(true);
    setDeliveryFailed(false);

    try {
      const feedbackData = {
        type,
        message: message.trim(),
        app_version: (window as { __APP_VERSION__?: string }).__APP_VERSION__ || "unknown",
        platform,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      };

      const sent = await submitQuickFeedback(feedbackData);
      if (!sent) {
        logger.warn("[Feedback] Delivery did not complete; keeping the draft for retry");
        setDeliveryFailed(true);
        return;
      }

      handleClose();
    } catch (error) {
      logger.error("[Feedback] Error:", error);
      setDeliveryFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes: {
    value: FeedbackType;
    icon: typeof Bug;
    label: string;
  }[] = [
    { value: "bug", icon: Bug, label: t.feedbackBug || "Bug" },
    {
      value: "feature",
      icon: Lightbulb,
      label: t.feedbackFeature || "Feature",
    },
    { value: "other", icon: HelpCircle, label: t.feedbackOther || "Other" },
  ];

  const positionClasses = position === "bottom-right" ? "end-4 bottom-20" : "start-4 bottom-20";

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg",
            "hover:bg-primary/90 active:scale-95 motion-safe:transition-all",
            "bottom-[calc(var(--nav-height)+var(--safe-bottom)+1rem)]",
            positionClasses,
            className
          )}
          aria-label={t.sendFeedback || "Send feedback"}
        >
          <MessageSquarePlus className="w-6 h-6" />
        </button>
      )}

      {/* Feedback Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-[calc(1rem+var(--safe-bottom))] bg-black/50 dark:bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label={t.ariaFeedback}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-xl motion-safe:animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t.sendFeedback || "Send Feedback"}</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={t.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Type Selection */}
              <div className="flex gap-2">
                {feedbackTypes.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border motion-safe:transition-all",
                      type === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-border hover:border-primary/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>

              {/* Message Input */}
              <label htmlFor={feedbackMessageId} className="sr-only">
                {feedbackMessageLabel}
              </label>
              <textarea
                id={feedbackMessageId}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setDeliveryFailed(false);
                }}
                placeholder={feedbackMessageLabel}
                className="w-full h-32 p-3 rounded-xl border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                maxLength={1000}
              />

              {/* Character count */}
              <p className="text-xs text-muted-foreground text-end">{message.length}/1000</p>

              {deliveryFailed && (
                <p role="status" className="text-sm text-destructive">
                  {t.feedbackError || "Could not send. Your message is still here — try again."}
                </p>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || isSubmitting}
                className={cn(
                  "w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 motion-safe:transition-all",
                  message.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {isSubmitting ? t.sending || "Sending..." : t.send || "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
