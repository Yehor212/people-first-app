import { useEffect, useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmojiOrIcon } from "@/components/icons";
import { useDopamineSettings } from "./DopamineSettings";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useBackHandler } from "@/hooks/useBackHandler";

/**
 * Streak Celebration - Duolingo-style fire animation
 */
interface StreakCelebrationProps {
  streakDays: number;
  onClose: () => void;
}

export function StreakCelebration({ streakDays, onClose }: StreakCelebrationProps) {
  const { t } = useLanguage();
  const dopamine = useDopamineSettings();
  const [show, setShow] = useState(false);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showAnimations = dopamine.animations;
  const showStreakFire = dopamine.streakFire && showAnimations;

  useBackHandler(show, onClose);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(
      () => {
        setShow(false);
        innerTimerRef.current = setTimeout(onClose, showAnimations ? 300 : 0);
      },
      showAnimations ? 3000 : 1500
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(innerTimerRef.current);
    };
  }, [onClose, showAnimations]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[220] flex items-center justify-center bg-black/40 backdrop-blur-sm",
        showAnimations && "motion-safe:transition-opacity motion-safe:duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex flex-col items-center",
          showAnimations && "motion-safe:transition-all motion-safe:duration-500",
          show ? "scale-100 opacity-100" : showAnimations ? "scale-50 opacity-0" : "opacity-0"
        )}
      >
        {/* Fire animation - only if streakFire enabled */}
        <div className="relative">
          <div className={showStreakFire ? "motion-safe:animate-bounce-fire" : ""}>
            <EmojiOrIcon emoji="🔥" iconName="fire" size="xl" className="w-20 h-20" />
          </div>
          {showStreakFire && (
            <>
              <div className="absolute -top-2 -left-4 motion-safe:animate-bounce-fire-delayed">
                <EmojiOrIcon emoji="🔥" iconName="fire" size="lg" className="w-14 h-14" />
              </div>
              <div className="absolute -top-2 -right-4 motion-safe:animate-bounce-fire-delayed-2">
                <EmojiOrIcon emoji="🔥" iconName="fire" size="lg" className="w-14 h-14" />
              </div>
            </>
          )}
        </div>

        {/* Streak number */}
        <div
          className={cn(
            "mt-4 text-6xl font-black text-white",
            showAnimations && "motion-safe:animate-scale-in"
          )}
        >
          {streakDays}
        </div>

        {/* Text */}
        <p className="mt-2 text-2xl font-bold text-white">{t.streakDays || "Day Streak"}!</p>
        <p className="mt-1 text-lg text-white/70">{t.keepItUp || "Keep it up!"}</p>

        {/* Sparkles - only if animations enabled */}
        {showAnimations && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full motion-safe:animate-sparkle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Habit Completion Animation - checkmark with confetti
 */
interface HabitCompletionProps {
  habitName: string;
  onClose: () => void;
}

export function HabitCompletion({ habitName, onClose }: HabitCompletionProps) {
  const dopamine = useDopamineSettings();
  const [show, setShow] = useState(false);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showAnimations = dopamine.animations;

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      innerTimerRef.current = setTimeout(onClose, showAnimations ? 200 : 0);
    }, 1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(innerTimerRef.current);
    };
  }, [onClose, showAnimations]);

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-[150] bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]",
        showAnimations && "motion-safe:transition-all motion-safe:duration-300",
        show
          ? "opacity-100 translate-y-0"
          : showAnimations
            ? "opacity-0 translate-y-4"
            : "opacity-0"
      )}
    >
      <div className="flex items-center gap-3 px-6 py-3 bg-mood-good text-white rounded-full shadow-lg">
        <span className={cn("text-2xl", showAnimations && "motion-safe:animate-bounce-check")}>✓</span>
        <span className="font-semibold">{habitName}</span>
      </div>
    </div>
  );
}

/**
 * All Habits Complete - confetti celebration
 */
interface AllHabitsCompleteProps {
  onClose: () => void;
}

export function AllHabitsComplete({ onClose }: AllHabitsCompleteProps) {
  const { t } = useLanguage();
  const dopamine = useDopamineSettings();
  const [show, setShow] = useState(false);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showAnimations = dopamine.animations;
  const showConfetti = dopamine.confetti && showAnimations;

  useBackHandler(show, onClose);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(
      () => {
        setShow(false);
        innerTimerRef.current = setTimeout(onClose, showAnimations ? 300 : 0);
      },
      showAnimations ? 3500 : 1500
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(innerTimerRef.current);
    };
  }, [onClose, showAnimations]);

  const confettiColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#FFE66D",
    "#95E1D3",
    "#F38181",
    "#AA96DA",
    "#FCBAD3",
  ];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[220] flex items-center justify-center bg-black/50 backdrop-blur-sm",
        showAnimations && "motion-safe:transition-opacity motion-safe:duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      {/* Confetti - only if confetti enabled */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 motion-safe:animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: confettiColors[i % confettiColors.length],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "relative flex flex-col items-center",
          showAnimations && "motion-safe:transition-all motion-safe:duration-500",
          show ? "scale-100 opacity-100" : showAnimations ? "scale-50 opacity-0" : "opacity-0"
        )}
      >
        <div className={showAnimations ? "motion-safe:animate-bounce" : ""}>
          <EmojiOrIcon emoji="🎉" iconName="celebration" size="xl" className="w-16 h-16" />
        </div>
        <p className="mt-4 text-3xl font-black text-white text-center">
          {t.allHabitsComplete || "All Habits Done!"}
        </p>
        <p className="mt-2 text-lg text-white/70">{t.amazingWork || "Amazing work today!"}</p>
      </div>
    </div>
  );
}

/**
 * Mood Changed Toast
 */
interface MoodChangedToastProps {
  emoji: string;
  message?: string;
  onClose?: () => void;
}

export function MoodChangedToast({ emoji, message, onClose }: MoodChangedToastProps) {
  const { t } = useLanguage();
  const dopamine = useDopamineSettings();
  const [show, setShow] = useState(true);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showAnimations = dopamine.animations;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      if (onClose) {
        innerTimerRef.current = setTimeout(onClose, showAnimations ? 200 : 0);
      }
    }, 2000);
    return () => {
      clearTimeout(timer);
      clearTimeout(innerTimerRef.current);
    };
  }, [onClose, showAnimations]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-[150] bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]",
        showAnimations && "motion-safe:transition-all motion-safe:duration-300",
        show
          ? "opacity-100 translate-y-0"
          : showAnimations
            ? "opacity-0 translate-y-4"
            : "opacity-0"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-6 py-3 bg-primary text-white rounded-full shadow-lg",
          showAnimations && "motion-safe:animate-success-pulse"
        )}
      >
        <EmojiOrIcon emoji={emoji} size="sm" />
        <span className="font-semibold">{message || t.moodUpdated || "Mood updated"}</span>
      </div>
    </div>
  );
}

/**
 * Confirm Dialog for misclick protection
 */
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const stableOnCancel = useCallback(() => onCancel(), [onCancel]);
  useModalA11y(true, stableOnCancel);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaConfirmation}
        className="bg-card rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl motion-safe:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 motion-safe:transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 font-medium rounded-xl motion-safe:transition-colors",
              variant === "destructive"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
