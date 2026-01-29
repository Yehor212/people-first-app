/**
 * Onboarding Overlay
 *
 * Shows welcome message and day progress for new users.
 * Displays:
 * - Welcome screen (first time)
 * - Day progress (Day X of 4)
 * - Feature unlock notifications
 */

import { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getOnboardingState,
  shouldShowWelcome,
  markWelcomeSeen,
  getUnlockProgress,
  type OnboardingState,
} from '@/lib/onboardingFlow';

interface OnboardingOverlayProps {
  onClose?: () => void;
}

/**
 * Welcome Screen (first time only)
 */
export function WelcomeOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t.onboardingWelcomeTitle || 'Welcome to ZenFlow! 🌱',
      description:
        t.onboardingWelcomeDescription ||
        "We're excited to help you build better habits and understand what works for YOUR brain.",
      icon: '👋',
    },
    {
      title: t.onboardingDay1Title || "Let's start simple",
      description:
        t.onboardingDay1Description ||
        "For today, we'll focus on just two things: tracking your mood and creating your first habit. Your data is stored safely on your device.",
      icon: '🎯',
    },
    {
      title: t.onboardingGradualTitle || 'More features unlock gradually',
      description:
        t.onboardingGradualDescription ||
        "Over the next 4 days, you'll discover new features as you progress. No information overload!",
      icon: '✨',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-3 sm:px-4">
      <div className="relative max-w-lg w-full bg-card rounded-xl sm:rounded-2xl zen-shadow-card border border-border overflow-hidden animate-scale-in">
        {/* Header - responsive */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="text-3xl sm:text-4xl">{currentStep.icon}</div>
            <button
              onClick={() => {
                markWelcomeSeen();
                onClose();
              }}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </button>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{currentStep.title}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">{currentStep.description}</p>
        </div>

        {/* Progress dots - responsive */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
          <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 sm:w-8 bg-primary'
                    : i < step
                    ? 'w-1.5 sm:w-2 bg-primary/50'
                    : 'w-1.5 sm:w-2 bg-border'
                }`}
              />
            ))}
          </div>

          {/* Action button - responsive */}
          <button
            onClick={handleNext}
            className="w-full py-2.5 sm:py-3 px-4 bg-primary text-primary-foreground rounded-lg sm:rounded-xl font-medium hover:bg-primary/90 transition-colors zen-shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {step < steps.length - 1 ? t.onboardingNext || 'Next' : t.onboardingGetStarted || "Let's start!"}
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Day Progress Indicator (shown in header)
 */
export function DayProgressIndicator() {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(getUnlockProgress());
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
            {(t.onboardingDayProgress || 'Day {day} of {maxDay}')
              .replace('{day}', String(progress.day))
              .replace('{maxDay}', String(progress.maxDay))}
          </span>
        </div>
        <span className="text-[10px] sm:text-xs text-muted-foreground">
          {progress.unlockedCount}/{progress.totalCount} {t.onboardingFeaturesUnlocked || 'features'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 sm:h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(progress.unlockedCount / progress.totalCount) * 100}%` }}
        />
      </div>

      {/* Next unlock hint */}
      {progress.nextUnlock && (
        <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
          {t.onboardingNextUnlock || 'Next unlock'}: <span className="font-medium">{progress.nextUnlock.requirement}</span>
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
