/**
 * MindfulMoment - Micro-mindfulness popup
 * ADHD-friendly: Quick 10-30 second check-ins that don't break flow
 * Shows after focus sessions or on demand
 */

import { useState, useEffect, useCallback } from "react";
import { X, Heart, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalClose } from "@/hooks/useModalState";

import {
  MindfulPrompt,
  MINDFUL_TYPE_LABELS,
  getMindfulPromptText,
  getRandomMindfulPrompt,
  getRandomPostFocusPrompt,
} from "@/lib/mindfulPrompts";

interface MindfulMomentProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onViewProgress?: () => void;
  trigger?: "focus" | "manual" | "random";
  prompt?: MindfulPrompt; // Optional specific prompt
}

// Quick response options - use translation keys
const QUICK_RESPONSES = [
  { emoji: "😊", labelKey: "moodGood" as const },
  { emoji: "😐", labelKey: "moodOkay" as const },
  { emoji: "😔", labelKey: "moodNotGreat" as const },
] as const;

export function MindfulMoment({
  isOpen,
  onClose,
  onComplete,
  onViewProgress,
  trigger = "manual",
  prompt: providedPrompt,
}: MindfulMomentProps) {
  const { language, t } = useLanguage();
  useScrollLock(isOpen);
  useModalClose(isOpen, onClose);
  const [currentPrompt, setCurrentPrompt] = useState<MindfulPrompt | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showResponse, setShowResponse] = useState(false);

  // Initialize prompt when opened
  useEffect(() => {
    if (isOpen) {
      const prompt =
        providedPrompt ||
        (trigger === "focus" ? getRandomPostFocusPrompt() : getRandomMindfulPrompt());
      setCurrentPrompt(prompt);
      setCountdown(prompt.duration);
      setShowResponse(false);
    }
  }, [isOpen, providedPrompt, trigger]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShowResponse(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  // Handle response selection
  const handleResponse = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onComplete, onClose]);

  // Handle skip
  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen || !currentPrompt) return null;

  const promptText = getMindfulPromptText(currentPrompt, language);
  const typeLabel =
    MINDFUL_TYPE_LABELS[currentPrompt.type][language] || MINDFUL_TYPE_LABELS[currentPrompt.type].en;

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-[69] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={handleSkip}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] backdrop-blur-sm motion-safe:animate-fade-in md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaMindfulMoment}
      >
        <div className="max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl bg-card p-6 shadow-2xl motion-safe:animate-scale-in">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className="break-words hyphens-manual text-lg font-semibold text-foreground">
                  {t.mindfulMoment || "Mindful Moment"}
                </h3>
                <span className="break-words hyphens-manual text-xs text-muted-foreground">
                  {typeLabel}
                </span>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-2 hover:bg-secondary motion-safe:transition-colors"
              aria-label={t.close || "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prompt */}
          <div className="text-center mb-6">
            {currentPrompt.emoji && (
              <div className="text-5xl mb-4 motion-safe:animate-pulse">{currentPrompt.emoji}</div>
            )}
            <p className="break-words hyphens-manual text-xl font-medium leading-relaxed text-foreground">
              {promptText}
            </p>
          </div>

          {/* Timer or Response */}
          {!showResponse ? (
            <div className="text-center mb-6">
              <div className="relative w-20 h-20 mx-auto">
                {/* Progress ring */}
                <svg className="w-20 h-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="hsl(var(--secondary))"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="hsl(var(--accent))"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - countdown / currentPrompt.duration)}`}
                    className="motion-safe:transition-all motion-safe:duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                  {countdown}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {t.takeAMoment || "Take a moment..."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick response buttons */}
              {currentPrompt.type === "checkin" && (
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
                  {QUICK_RESPONSES.map((response) => (
                    <button
                      key={response.labelKey}
                      onClick={handleResponse}
                      className="flex min-h-[44px] h-auto min-w-0 flex-col items-center gap-1 rounded-xl bg-secondary p-3 hover:bg-secondary/80 motion-safe:transition-colors"
                    >
                      <span className="text-2xl">{response.emoji}</span>
                      <span className="break-words hyphens-manual text-xs text-muted-foreground">
                        {t[response.labelKey] || response.labelKey}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Done button for non-checkin prompts */}
              {currentPrompt.type !== "checkin" && (
                <button
                  onClick={handleResponse}
                  className="flex min-h-[44px] h-auto w-full items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-xl py-3 font-semibold text-primary-foreground zen-gradient"
                >
                  <Heart className="w-5 h-5" aria-hidden="true" />
                  {t.done || "Done"}
                </button>
              )}

              {/* View Progress link — shown after focus sessions */}
              {onViewProgress && trigger === "focus" && (
                <button
                  onClick={() => {
                    onComplete?.();
                    onClose();
                    onViewProgress();
                  }}
                  className="min-h-[44px] h-auto w-full whitespace-normal break-words hyphens-manual py-2 text-sm font-medium text-primary hover:text-primary/80 motion-safe:transition-colors"
                >
                  {t.viewProgress || "View Progress →"}
                </button>
              )}
            </div>
          )}

          {/* Skip link */}
          {!showResponse && (
            <button
              onClick={handleSkip}
              className="min-h-[44px] h-auto w-full whitespace-normal break-words hyphens-manual py-2 text-sm text-muted-foreground hover:text-foreground motion-safe:transition-colors"
            >
              {t.skip || "Skip"}
            </button>
          )}

          {/* XP hint */}
          <p className="mt-4 break-words hyphens-manual text-center text-xs text-muted-foreground">
            +3 XP • +1 {t.treat || "treat"}
          </p>
        </div>
      </div>
    </>
  );
}
