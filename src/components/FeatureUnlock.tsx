/**
 * Feature Unlock Celebration
 *
 * Shows when a new feature is unlocked with:
 * - Celebration animation
 * - Feature description
 * - "Try it now" CTA
 */

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Timer,
  Trophy,
  ClipboardList,
  Heart,
  Target,
} from "lucide-react";
import type { FeatureId } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";

interface FeatureUnlockProps {
  feature: FeatureId;
  onClose: () => void;
  onTryNow?: () => void;
}

// Feature metadata
const FEATURE_META: Record<
  FeatureId,
  {
    icon: typeof Sparkles;
    colorClass: string;
    bgClass: string;
  }
> = {
  mood: {
    icon: Heart,
    colorClass: "text-pink-500",
    bgClass: "bg-pink-50 dark:bg-pink-950",
  },
  habits: {
    icon: Target,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950",
  },
  focusTimer: {
    icon: Timer,
    colorClass: "text-purple-500",
    bgClass: "bg-purple-50 dark:bg-purple-950",
  },
  xp: {
    icon: Sparkles,
    colorClass: "text-yellow-500",
    bgClass: "bg-yellow-50 dark:bg-yellow-950",
  },
  quests: {
    icon: Sparkles,
    colorClass: "text-yellow-500",
    bgClass: "bg-yellow-50 dark:bg-yellow-950",
  },
  companion: {
    icon: Heart,
    colorClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-950",
  },
  tasks: {
    icon: ClipboardList,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950",
  },
  challenges: {
    icon: Trophy,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
  },
};

export function FeatureUnlock({
  feature,
  onClose,
  onTryNow,
}: FeatureUnlockProps) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const tryNowTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const meta = FEATURE_META[feature];
  const Icon = meta.icon;

  // Entrance animation
  useEffect(() => {
    setIsVisible(true);

    // Generate celebration particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);

    return () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(tryNowTimerRef.current);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, 300); // Wait for exit animation
  };

  useBackHandler(true, handleClose);

  const handleTryNow = () => {
    handleClose();
    if (onTryNow) {
      clearTimeout(tryNowTimerRef.current);
      tryNowTimerRef.current = setTimeout(onTryNow, 400);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-unlock-title"
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose(); }}
    >
      {/* Celebration particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: "2s",
          }}
        />
      ))}

      {/* Main card */}
      <div
        className={`relative max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-md transform overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card zen-shadow-card motion-safe:transition-all motion-safe:duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } }}
      >
        {/* Header with icon */}
        <div className={`p-6 ${meta.bgClass} border-b border-border`}>
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-4 rounded-full ${meta.bgClass} ring-4 ring-white dark:ring-gray-900 mb-4 motion-safe:animate-bounce-slow`}
            >
              <Icon className={`w-12 h-12 ${meta.colorClass}`} />
            </div>
            <h2
              id="feature-unlock-title"
              className="mb-2 break-words hyphens-manual text-2xl font-bold text-foreground"
            >
              {(t as unknown as Record<string, string>)[
                `onboarding${feature}UnlockTitle`
              ] || "🎉 New Feature Unlocked!"}
            </h2>
            <p className="break-words hyphens-manual text-sm text-muted-foreground">
              {(t as unknown as Record<string, string>)[
                `onboarding${feature}UnlockSubtitle`
              ] || "You've made great progress!"}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="p-6">
          <p className="mb-6 break-words hyphens-manual leading-relaxed text-foreground">
            {(t as unknown as Record<string, string>)[
              `onboarding${feature}Description`
            ] || "This new feature will help you on your journey."}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 min-[360px]:flex-row">
            {onTryNow && (
              <button
                onClick={handleTryNow}
                className="min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground zen-shadow-sm hover:bg-primary/90 motion-safe:transition-colors"
              >
                {t.onboardingTryNow || "Try it now"}
              </button>
            )}
            <button
              onClick={handleClose}
              className="min-h-[44px] h-auto min-w-0 flex-1 whitespace-normal break-words hyphens-manual rounded-xl border border-border bg-card px-4 py-3 font-medium text-foreground hover:bg-accent motion-safe:transition-colors"
            >
              {t.onboardingGotIt || "Got it!"}
            </button>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className={`h-2 ${meta.bgClass}`} />
      </div>
    </div>
  );
}
