import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Streak Celebration - Duolingo-style fire animation
 */
interface StreakCelebrationProps {
  streakDays: number;
  onClose: () => void;
}

export function StreakCelebration({ streakDays, onClose }: StreakCelebrationProps) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex flex-col items-center transition-all duration-500",
          show ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        {/* Fire animation */}
        <div className="relative">
          <div className="text-8xl animate-bounce-fire">🔥</div>
          <div className="absolute -top-2 -left-4 text-6xl animate-bounce-fire-delayed">🔥</div>
          <div className="absolute -top-2 -right-4 text-6xl animate-bounce-fire-delayed-2">🔥</div>
        </div>

        {/* Streak number */}
        <div className="mt-4 text-6xl font-black text-white animate-scale-in">
          {streakDays}
        </div>

        {/* Text */}
        <p className="mt-2 text-2xl font-bold text-white">
          {t.streakDays || 'Day Streak'}!
        </p>
        <p className="mt-1 text-lg text-white/70">
          {t.keepItUp || 'Keep it up!'}
        </p>

        {/* Sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            />
          ))}
        </div>
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
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 200);
    }, 1500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center gap-3 px-6 py-3 bg-mood-good text-white rounded-full shadow-lg">
        <span className="text-2xl animate-bounce-check">✓</span>
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
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const confettiColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 animate-confetti"
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

      {/* Content */}
      <div
        className={cn(
          "relative flex flex-col items-center transition-all duration-500",
          show ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        <div className="text-7xl animate-bounce">🎉</div>
        <p className="mt-4 text-3xl font-black text-white text-center">
          {t.allHabitsComplete || 'All Habits Done!'}
        </p>
        <p className="mt-2 text-lg text-white/70">
          {t.amazingWork || 'Amazing work today!'}
        </p>
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
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      if (onClose) {
        setTimeout(onClose, 200);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="flex items-center gap-3 px-6 py-3 bg-primary text-white rounded-full shadow-lg animate-success-pulse">
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold">{message || t.moodUpdated || 'Mood updated'}</span>
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
  variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scale-in">
        <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 font-medium rounded-xl transition-colors",
              variant === 'destructive'
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
