/**
 * Welcome Back Modal
 *
 * Shows when user returns after 3+ days of absence.
 * Features:
 * - Friendly welcome message
 * - Streak status (protected or lost)
 * - Habit suggestions based on past success rate
 * - Quick mood check-in option
 * - Comeback Challenge for bonus XP (Stage 5 retention)
 */

import { useState } from "react";
import { Heart, TrendingUp, Calendar, Sparkles, X, Zap, Target } from "lucide-react";
import { motion } from "framer-motion";
import { zenMotion, zenTap, zenHover } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import { MoodEntry, Habit } from "@/types";
import { startComebackChallenge } from "@/lib/comebackChallenge";

interface WelcomeBackModalProps {
  daysAway: number;
  streakBroken: boolean;
  currentStreak: number;
  topHabits: Array<{ habit: Habit; successRate: number }>;
  onClose: () => void;
  onQuickMoodLog?: (mood: MoodEntry["mood"]) => void;
  onStartComebackChallenge?: () => void;
}

export function WelcomeBackModal({
  daysAway,
  streakBroken,
  currentStreak,
  topHabits,
  onClose,
  onQuickMoodLog,
}: WelcomeBackModalProps) {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodEntry["mood"] | null>(null);

  useBackHandler(true, onClose);

  // Add keyboard accessibility (escape, focus trap, focus restore)
  const { modalProps } = useModalKeyboard({
    isOpen: true, // Component only renders when open
    onClose,
    closeOnEscape: true,
    trapFocus: true,
    restoreFocus: true,
  });

  const moods: Array<{ emoji: string; value: MoodEntry["mood"]; label: string }> = [
    { emoji: "😊", value: "great", label: t.moodGreat || "Great" },
    { emoji: "🙂", value: "good", label: t.moodGood || "Good" },
    { emoji: "😐", value: "okay", label: t.moodOkay || "Okay" },
    { emoji: "😕", value: "bad", label: t.moodBad || "Bad" },
    { emoji: "😢", value: "terrible", label: t.moodTerrible || "Terrible" },
  ];

  const handleMoodSelect = (mood: MoodEntry["mood"]) => {
    setSelectedMood(mood);
    if (onQuickMoodLog) {
      onQuickMoodLog(mood);
    }
  };

  const handleContinue = useThrottledCallback(() => {
    onClose();
  }, 1000);

  const handleAcceptChallenge = useThrottledCallback(() => {
    startComebackChallenge();
    onClose();
  }, 1000);

  return (
    <>
      {/* A11Y-OK: decorative backdrop overlay — aria-hidden removes from accessibility tree, no aria-label needed */}
      <div
        className="hidden md:block fixed inset-0 z-[69] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] backdrop-blur-sm motion-safe:animate-fade-in md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl">
        <div
          {...modalProps}
          aria-labelledby="welcome-back-title"
          className="relative max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card zen-shadow-card motion-safe:animate-scale-in"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="shrink-0 rounded-full bg-primary/20 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="welcome-back-title"
                    className="break-words hyphens-manual text-2xl font-bold text-foreground"
                  >
                    {t.reengageTitle || "Welcome Back!"} 👋
                  </h2>
                  <p className="break-words hyphens-manual text-sm text-muted-foreground">
                    {(t.reengageSubtitle || "You've been away for {days} days").replace(
                      "{days}",
                      String(daysAway)
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t.close || "Close"}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 hover:bg-foreground/5 motion-safe:transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Streak Status */}
            <div
              className={`p-4 rounded-xl border ${
                streakBroken
                  ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                  : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Calendar
                  className={`w-5 h-5 ${
                    streakBroken
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                />
                <h3 className="break-words hyphens-manual font-semibold text-foreground">
                  {streakBroken
                    ? t.reengageStreakBroken || "Streak Status"
                    : t.reengageStreakProtected || "Streak Protected!"}
                </h3>
              </div>
              <p className="break-words hyphens-manual text-sm text-muted-foreground">
                {streakBroken
                  ? (
                      t.reengageStreakBrokenMsg ||
                      "Your streak was reset, but you can start fresh today! Previous streak: {streak} days."
                    ).replace("{streak}", String(currentStreak))
                  : (
                      t.reengageStreakProtectedMsg ||
                      "Your {streak}-day streak is safe! Keep going!"
                    ).replace("{streak}", String(currentStreak))}
              </p>
            </div>

            {/* Top Habits */}
            {topHabits.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="break-words hyphens-manual font-semibold text-foreground">
                    {t.reengageBestHabits || "Your Best Habits"}
                  </h3>
                </div>
                <div className="space-y-2">
                  {topHabits.slice(0, 3).map(({ habit, successRate }) => (
                    <div
                      key={habit.id}
                      className="flex flex-col items-stretch gap-2 rounded-lg bg-accent p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="shrink-0 text-2xl">{habit.icon}</span>
                        <span className="min-w-0 [overflow-wrap:anywhere] font-medium text-foreground">
                          {habit.name}
                        </span>
                      </div>
                      <span className="break-words hyphens-manual text-sm font-semibold text-primary">
                        {Math.round(successRate)}% {t.reengageSuccessRate || "success"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comeback Challenge Offer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...zenMotion.gentle, delay: 0.2 }}
              className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/30"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 break-words hyphens-manual font-semibold text-foreground">
                    {t.comebackChallengeTitle || "Comeback Challenge"}
                    <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                  </h3>
                  <p className="break-words hyphens-manual text-xs text-muted-foreground">
                    {t.comebackChallengeSubtitle || "A gentle step back in"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex flex-col items-stretch gap-1 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <span className="break-words hyphens-manual text-muted-foreground">
                    {t.comebackChallengeGoal || "Complete 3 habits for 3 days"}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">+100 XP</span>
                </div>
                <div className="h-2 bg-violet-500/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 w-full origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={zenMotion.gentle}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {t.comebackChallengeTime || "3 days to complete"}
                </p>
              </div>

              <motion.button
                whileHover={zenHover.lift}
                whileTap={zenTap.button}
                onClick={handleAcceptChallenge}
                className="flex min-h-[44px] h-auto w-full items-center justify-center gap-2 whitespace-normal break-words hyphens-manual rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2.5 font-medium text-white zen-shadow-sm hover:from-violet-600 hover:to-purple-600 motion-safe:transition-all"
              >
                <Target className="w-4 h-4" />
                {t.comebackChallengeAccept || "Accept Challenge"}
              </motion.button>
            </motion.div>

            {/* Quick Mood Check-in */}
            {onQuickMoodLog && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <h3 className="font-semibold text-foreground">
                    {t.reengageQuickMood || "How are you feeling?"}
                  </h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-2">
                  {moods.map((mood) => (
                    <button
                      key={mood.value}
                      onClick={() => handleMoodSelect(mood.value)}
                      className={`min-h-[44px] h-auto rounded-xl p-3 motion-safe:transition-all ${
                        selectedMood === mood.value
                          ? "bg-primary text-primary-foreground scale-110 zen-shadow-sm"
                          : "bg-accent hover:bg-accent/80"
                      }`}
                    >
                      <div className="text-2xl mb-1">{mood.emoji}</div>
                      <div className="break-words hyphens-manual text-xs font-medium">
                        {mood.label}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedMood && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400 text-center">
                    ✓ {t.reengageMoodLogged || "Mood logged!"}
                  </p>
                )}
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              className="min-h-[44px] h-auto w-full whitespace-normal break-words hyphens-manual rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground zen-shadow-sm hover:bg-primary/90 motion-safe:transition-colors"
            >
              {t.reengageContinue || "Let's continue!"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
