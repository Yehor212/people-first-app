/**
 * Onboarding Overlay
 *
 * Shows welcome message and day progress for new users.
 * Displays:
 * - Welcome screen (first time)
 * - Day progress (Day X of 4)
 * - Feature unlock notifications
 */

import { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalA11y } from "@/hooks/useModalA11y";
import {
  getOnboardingState,
  shouldShowWelcome,
  markWelcomeSeen,
  getUnlockProgress,
} from "@/lib/onboardingFlow";

interface OnboardingOverlayProps {
  onClose?: () => void;
}

/**
 * Welcome Screen (first time only)
 */
export function WelcomeOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  useScrollLock(true);
  const handleClose = () => {
    markWelcomeSeen();
    onClose();
  };
  const { modalRef, handleKeyDown } = useModalA11y(true, handleClose);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t.onboardingWelcomeTitle || "Welcome to ZenFlow! 🌱",
      description:
        t.onboardingWelcomeDescription ||
        "We're excited to help you build better habits and understand what works for YOUR brain.",
      icon: "👋",
    },
    {
      title: t.onboardingDay1Title || "Let's start simple",
      description:
        t.onboardingDay1Description ||
        "For today, we'll focus on just two things: tracking your mood and creating your first habit. Your data is stored safely on your device.",
      icon: "🎯",
    },
    {
      title: t.onboardingGradualTitle || "More features unlock gradually",
      description:
        t.onboardingGradualDescription ||
        "Over the next 4 days, you'll discover new features as you progress. No information overload!",
      icon: "✨",
    },
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      markWelcomeSeen();
      onClose();
    }
  };

  return (
    <>
      {/* A11Y-OK: decorative backdrop overlay — aria-hidden removes from accessibility tree, no aria-label needed */}
      <div
        className="hidden md:block fixed inset-0 z-[79] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={() => {
          markWelcomeSeen();
          onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in px-3 sm:px-4 md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-welcome-title"
      >
        <div className="relative max-w-lg w-full bg-card rounded-xl sm:rounded-2xl zen-shadow-card border border-border overflow-hidden motion-safe:animate-scale-in">
          {/* Header - responsive */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="text-3xl sm:text-4xl">{currentStep.icon}</div>
              <button
                onClick={() => {
                  markWelcomeSeen();
                  onClose();
                }}
                aria-label={t.close}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-foreground/5 rounded-lg motion-safe:transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </button>
            </div>
            <h2
              id="onboarding-welcome-title"
              className="text-xl sm:text-2xl font-bold text-foreground mb-2"
            >
              {currentStep.title}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">{currentStep.description}</p>
          </div>

          {/* Progress dots - responsive */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
            <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 sm:h-2 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                    i === step
                      ? "w-6 sm:w-8 bg-primary"
                      : i < step
                        ? "w-1.5 sm:w-2 bg-primary/50"
                        : "w-1.5 sm:w-2 bg-border"
                  }`}
                />
              ))}
            </div>

            {/* Action button - responsive */}
            <button
              onClick={handleNext}
              className="w-full py-2.5 sm:py-3 px-4 bg-primary text-primary-foreground rounded-lg sm:rounded-xl font-medium hover:bg-primary/90 motion-safe:transition-colors zen-shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {step < steps.length - 1
                ? t.onboardingNext || "Next"
                : t.onboardingGetStarted || "Let's start!"}
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rtl:scale-x-[-1]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Day Progress Indicator (shown in header)
 */
export function DayProgressIndicator() {
  const { t } = useLanguage();
  const [progress, _setProgress] = useState(getUnlockProgress());
  const state = getOnboardingState();

  // Skip for existing users
  if (!state.isNewUser || state.daysActive >= 4) {
    return null;
  }

  return (
    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg sm:rounded-xl border border-border zen-shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="font-semibold text-sm sm:text-base text-foreground">
            {(t.onboardingDayProgress || "Day {day} of {maxDay}")
              .replace("{day}", String(progress.day))
              .replace("{maxDay}", String(progress.maxDay))}
          </span>
        </div>
        <span className="text-xs sm:text-xs text-muted-foreground">
          {progress.unlockedCount}/{progress.totalCount}{" "}
          {t.onboardingFeaturesUnlocked || "features"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 sm:h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary motion-safe:transition-all motion-safe:duration-500 ease-out"
          style={{
            width: `${(progress.unlockedCount / progress.totalCount) * 100}%`,
          }}
        />
      </div>

      {/* Next unlock hint */}
      {progress.nextUnlock && (
        <p className="mt-1.5 sm:mt-2 text-xs sm:text-xs text-muted-foreground">
          {t.onboardingNextUnlock || "Next unlock"}:{" "}
          <span className="font-medium">{progress.nextUnlock.requirement}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Main Onboarding Overlay Manager
 * Decides what to show (welcome, day progress, etc.)
 */
export function OnboardingOverlay({ onClose }: OnboardingOverlayProps) {
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome());

  useEffect(() => {
    setShowWelcome(shouldShowWelcome());
  }, []);

  if (showWelcome) {
    return (
      <WelcomeOverlay
        onClose={() => {
          setShowWelcome(false);
          onClose?.();
        }}
      />
    );
  }

  return null;
}
