import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { Share2, Copy, Check, Trophy, Clock, Trash2 } from "lucide-react";
import { cn, interpolate } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { hapticSuccess, hapticTap, hapticWarning } from "@/lib/haptics";
import { useThrottledCallback } from "@/hooks/useThrottledCallback";
import {
  Challenge,
  shareChallenge,
  getChallengeProgress,
  getDaysRemaining,
  deleteChallenge,
} from "@/lib/friendChallenge";
import type { Translations } from "@/i18n/types";
import { ParticipantsLeaderboard } from "./ParticipantsLeaderboard";

export function ChallengeDetailsView({
  challenge,
  onBack: _onBack,
  onDelete,
  t,
  username,
}: {
  challenge: Challenge;
  onBack: () => void;
  onDelete: () => void;
  t: Translations;
  username?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const throttledCopyCode = useThrottledCallback(async () => {
    void hapticTap();
    try {
      await navigator.clipboard.writeText(challenge.code);
      setCopied(true);
      void hapticSuccess();
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      void hapticWarning();
    }
  }, 1000);

  const throttledShare = useThrottledCallback(async () => {
    void hapticTap();
    setIsSharing(true);
    try {
      const success = await shareChallenge(
        challenge,
        t as unknown as Record<string, string>,
      );
      if (success) {
        void hapticSuccess();
      }
    } catch (err) {
      logger.warn("[Challenge] Share failed:", err);
    }
    setIsSharing(false);
  }, 1000);

  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  // Calculate statistics
  const daysPassed = Math.max(0, challenge.duration - daysLeft);
  const expectedProgress =
    challenge.duration > 0
      ? Math.round((daysPassed / challenge.duration) * 100)
      : 0;
  const isAheadOfSchedule = progress > expectedProgress;
  const isBehindSchedule = progress < expectedProgress - 10;

  // Get motivational message
  const getMotivationalMessage = (): string => {
    if (challenge.status === "completed") {
      return t.challengeWon || "🎉 Amazing! You completed the challenge!";
    }
    if (challenge.status === "expired") {
      return t.challengeExpired || "Challenge ended. Try again next time!";
    }
    if (progress >= 80) {
      return t.almostThere || "🔥 Almost there! Keep pushing!";
    }
    if (isAheadOfSchedule) {
      return t.aheadOfSchedule || "⭐ Great pace! You're ahead of schedule!";
    }
    if (isBehindSchedule) {
      return t.catchUp || "💪 You can catch up! Every day counts!";
    }
    return t.keepGoing || "👍 Keep going! You're doing great!";
  };

  // handleShare and handleCopyCode are throttled above (throttledShare, throttledCopyCode)

  const handleDelete = useThrottledCallback(() => {
    void hapticWarning();
    if (confirm(t.confirmDeleteChallenge || "Delete this challenge?")) {
      deleteChallenge(challenge.id);
      onDelete();
    }
  }, 800);

  return (
    <div className="space-y-6 pb-8">
      {/* Header with icon - Premium */}
      <motion.div
        className="relative min-w-0 text-center py-8 rounded-2xl overflow-hidden bg-[linear-gradient(180deg,hsl(var(--cosmic-nebula-purple)/0.15)_0%,transparent_100%)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Glow behind icon */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-40 bg-[radial-gradient(circle,hsl(var(--cosmic-nebula-purple)/0.4)_0%,transparent_70%)]" />
        <motion.div
          className="text-6xl mb-3 relative z-10"
          initial={prefersReducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 20 }
          }
        >
          {challenge.habitIcon}
        </motion.div>
        <h3 className="relative z-10 min-w-0 break-words px-4 text-xl font-bold text-slate-800 dark:text-white [overflow-wrap:anywhere]">
          {challenge.habitName}
        </h3>
        <p className="relative z-10 min-w-0 break-words px-4 text-sm text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
          {challenge.duration} {t.dayChallenge || "day challenge"}
        </p>
      </motion.div>

      {/* Progress section - Premium */}
      <motion.div
        className="relative min-w-0 overflow-hidden rounded-2xl p-5 bg-[linear-gradient(135deg,theme(colors.white/0.05)_0%,theme(colors.white/0.02)_100%)] shadow-[inset_0_1px_0_theme(colors.white/0.05)]"
        data-testid="challenge-personal-progress"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 mb-4">
          <span className="min-w-0 break-words text-sm font-medium text-slate-800 dark:text-white [hyphens:manual] [overflow-wrap:break-word]">
            {t.yourProgress || "Your Progress"}
          </span>
          <span className="min-w-0 break-words text-sm text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
            {challenge.myProgress}/{challenge.duration} {t.days || "days"}
          </span>
        </div>

        <div className="h-3 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full w-full origin-left shadow-[0_0_12px_theme(colors.emerald.500/0.5)]"
            initial={prefersReducedMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: "easeOut" }
            }
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 text-xs">
          <span className="min-w-0 break-words text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
            {interpolate(t.challengeProgressComplete || "{percent}% complete", {
              percent: `\u2068${progress}\u2069`,
            })}
          </span>
          {challenge.status === "active" && (
            <span className="flex min-w-0 items-center gap-1 break-words text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {daysLeft} {t.daysLeft || "days left"}
            </span>
          )}
          {challenge.status === "completed" && (
            <span className="flex max-w-full min-w-0 items-center gap-1 whitespace-normal break-words px-2 py-0.5 rounded-full text-amber-700 dark:text-amber-300 bg-amber-500/20 [hyphens:manual] [overflow-wrap:break-word]">
              <Trophy className="w-3 h-3 shrink-0" aria-hidden="true" />
              {t.challengeCompleted || "Challenge Complete!"}
            </span>
          )}
        </div>
      </motion.div>

      {/* Motivational message */}
      <div
        className={cn(
          "min-w-0 break-words p-4 rounded-2xl text-center font-medium [hyphens:manual] [overflow-wrap:break-word]",
          challenge.status === "completed"
            ? "bg-accent/10 text-accent dark:bg-accent/20"
            : isAheadOfSchedule
              ? "bg-[hsl(var(--mood-good))]/10 text-[hsl(var(--mood-good))] dark:bg-[hsl(var(--mood-good))]/20"
              : isBehindSchedule
                ? "bg-[hsl(var(--mood-okay))]/10 text-[hsl(var(--mood-okay))] dark:bg-[hsl(var(--mood-okay))]/20"
                : "bg-primary/10 text-primary dark:bg-primary/20",
        )}
      >
        {getMotivationalMessage()}
      </div>

      {/* Statistics */}
      {challenge.status === "active" && (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]">
          <div className="min-w-0 bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="min-w-0 break-words text-2xl font-bold text-foreground">
              {daysPassed}
            </div>
            <div className="min-w-0 break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {t.daysPassed || "Days Passed"}
            </div>
          </div>
          <div className="min-w-0 bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="min-w-0 break-words text-2xl font-bold text-[hsl(var(--mood-good))]">
              {challenge.myProgress}
            </div>
            <div className="min-w-0 break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {t.daysCompleted || "Completed"}
            </div>
          </div>
          <div className="min-w-0 bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="min-w-0 break-words text-2xl font-bold text-foreground">{daysLeft}</div>
            <div className="min-w-0 break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {t.daysRemaining || "Remaining"}
            </div>
          </div>
        </div>
      )}

      {/* Participants Leaderboard - Cloud Feature */}
      <ParticipantsLeaderboard
        challenge={challenge}
        t={t as unknown as Record<string, string>}
        username={username}
      />

      {/* Challenge code - Premium */}
      <motion.div
        className="relative rounded-2xl p-5 overflow-hidden bg-[linear-gradient(135deg,theme(colors.emerald.500/0.1)_0%,theme(colors.teal.500/0.05)_100%)] shadow-[0_0_20px_theme(colors.emerald.500/0.15),inset_0_1px_0_theme(colors.white/0.05)]"
        data-testid="challenge-invitation-controls"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-sm font-medium text-slate-600 dark:text-white/80 mb-3">
          {t.challengeCode || "Challenge Code"}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl px-2.5 py-4 text-center bg-background/40 text-emerald-400 [text-shadow:0_0_10px_theme(colors.emerald.400/0.5)]">
            <bdi
              dir="ltr"
              className="block whitespace-nowrap font-mono text-[clamp(1rem,5.5vw,1.25rem)] tracking-[0.08em]"
            >
              {challenge.code}
            </bdi>
          </div>
          <motion.button
            onClick={throttledCopyCode}
            aria-label={
              copied ? t.copied || "Copied" : t.copyCode || "Copy code"
            }
            className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center motion-safe:transition-all",
              copied
                ? "bg-emerald-500/20 border border-emerald-500/40"
                : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10",
            )}
            style={
              copied
                ? { boxShadow: "0 0 12px hsl(160 84% 39% / 0.4)" }
                : undefined
            }
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? undefined : zenTap.button}
          >
            {copied ? (
              <Check className="w-6 h-6 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-6 h-6 text-slate-600 dark:text-white/70" aria-hidden="true" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Button variant="outline" onClick={handleDelete} className="h-auto min-h-12 min-w-0 whitespace-normal break-words py-3">
          <Trash2 className="w-4 h-4 me-2 shrink-0" aria-hidden="true" />
          {t.delete || "Delete"}
        </Button>

        <Button onClick={throttledShare} disabled={isSharing} className="h-auto min-h-12 min-w-0 whitespace-normal break-words py-3">
          <Share2 className="w-4 h-4 me-2 shrink-0" aria-hidden="true" />
          {isSharing ? t.sharing || "Sharing..." : t.shareButton || "Share"}
        </Button>
      </div>
    </div>
  );
}
