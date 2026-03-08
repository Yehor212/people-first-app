import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { Share2, Copy, Check, Trophy, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { hapticSuccess, hapticTap, hapticWarning } from '@/lib/haptics';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import {
  Challenge,
  shareChallenge,
  getChallengeProgress,
  getDaysRemaining,
  deleteChallenge,
} from '@/lib/friendChallenge';
import type { Translations } from '@/i18n/types';
import { ParticipantsLeaderboard } from './ParticipantsLeaderboard';

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
      const success = await shareChallenge(challenge, t as unknown as Record<string, string>);
      if (success) {
        void hapticSuccess();
      }
    } catch (err) {
      logger.warn('[Challenge] Share failed:', err);
    }
    setIsSharing(false);
  }, 1000);

  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  // Calculate statistics
  const daysPassed = Math.max(0, challenge.duration - daysLeft);
  const expectedProgress = challenge.duration > 0
    ? Math.round((daysPassed / challenge.duration) * 100)
    : 0;
  const isAheadOfSchedule = progress > expectedProgress;
  const isBehindSchedule = progress < expectedProgress - 10;

  // Get motivational message
  const getMotivationalMessage = (): string => {
    if (challenge.status === 'completed') {
      return t.challengeWon || '🎉 Amazing! You completed the challenge!';
    }
    if (challenge.status === 'expired') {
      return t.challengeExpired || 'Challenge ended. Try again next time!';
    }
    if (progress >= 80) {
      return t.almostThere || '🔥 Almost there! Keep pushing!';
    }
    if (isAheadOfSchedule) {
      return t.aheadOfSchedule || '⭐ Great pace! You\'re ahead of schedule!';
    }
    if (isBehindSchedule) {
      return t.catchUp || '💪 You can catch up! Every day counts!';
    }
    return t.keepGoing || '👍 Keep going! You\'re doing great!';
  };

  // handleShare and handleCopyCode are throttled above (throttledShare, throttledCopyCode)

  const handleDelete = useThrottledCallback(() => {
    void hapticWarning();
    if (confirm(t.confirmDeleteChallenge || 'Delete this challenge?')) {
      deleteChallenge(challenge.id);
      onDelete();
    }
  }, 800);

  return (
    <div className="space-y-6 pb-8">
      {/* Header with icon - Premium */}
      <motion.div
        className="relative text-center py-8 rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.15) 0%, transparent 100%)',
        }}
      >
        {/* Glow behind icon */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)' }}
        />
        <motion.div
          className="text-6xl mb-3 relative z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {challenge.habitIcon}
        </motion.div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white relative z-10">{challenge.habitName}</h3>
        <p className="text-sm text-slate-500 dark:text-white/60 relative z-10">
          {challenge.duration} {t.dayChallenge || 'day challenge'}
        </p>
      </motion.div>

      {/* Progress section - Premium */}
      <motion.div
        className="rounded-2xl p-5 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-800 dark:text-white">
            {t.yourProgress || 'Your Progress'}
          </span>
          <span className="text-sm text-slate-500 dark:text-white/60">
            {challenge.myProgress}/{challenge.duration} {t.days || 'days'}
          </span>
        </div>

        <div className="h-3 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ width: '100%', transformOrigin: 'left center', boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)' }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-white/60">{progress}% {t.complete || 'complete'}</span>
          {challenge.status === 'active' && (
            <span className="flex items-center gap-1 text-slate-500 dark:text-white/60">
              <Clock className="w-3 h-3" />
              {daysLeft} {t.daysLeft || 'days left'}
            </span>
          )}
          {challenge.status === 'completed' && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-amber-700 dark:text-amber-300"
              style={{ background: 'rgba(245, 158, 11, 0.2)' }}
            >
              <Trophy className="w-3 h-3" />
              {t.challengeCompleted || 'Challenge Complete!'}
            </span>
          )}
        </div>
      </motion.div>

      {/* Motivational message */}
      <div className={cn(
        'p-4 rounded-2xl text-center font-medium',
        challenge.status === 'completed'
          ? 'bg-accent/10 text-accent dark:bg-accent/20'
          : isAheadOfSchedule
            ? 'bg-[hsl(var(--mood-good))]/10 text-[hsl(var(--mood-good))] dark:bg-[hsl(var(--mood-good))]/20'
            : isBehindSchedule
              ? 'bg-[hsl(var(--mood-okay))]/10 text-[hsl(var(--mood-okay))] dark:bg-[hsl(var(--mood-okay))]/20'
              : 'bg-primary/10 text-primary dark:bg-primary/20'
      )}>
        {getMotivationalMessage()}
      </div>

      {/* Statistics */}
      {challenge.status === 'active' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="text-2xl font-bold text-foreground">{daysPassed}</div>
            <div className="text-xs text-muted-foreground">{t.daysPassed || 'Days Passed'}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="text-2xl font-bold text-[hsl(var(--mood-good))]">{challenge.myProgress}</div>
            <div className="text-xs text-muted-foreground">{t.daysCompleted || 'Completed'}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="text-2xl font-bold text-foreground">{daysLeft}</div>
            <div className="text-xs text-muted-foreground">{t.daysRemaining || 'Remaining'}</div>
          </div>
        </div>
      )}

      {/* Participants Leaderboard - Cloud Feature */}
      <ParticipantsLeaderboard challenge={challenge} t={t as unknown as Record<string, string>} username={username} />

      {/* Challenge code - Premium */}
      <motion.div
        className="relative rounded-2xl p-5 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.05) 100%)',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div className="text-sm font-medium text-slate-600 dark:text-white/80 mb-3">
          {t.challengeCode || 'Challenge Code'}
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex-1 rounded-xl px-4 py-4 font-mono text-2xl text-center tracking-widest"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#34d399',
              textShadow: '0 0 10px rgba(52, 211, 153, 0.5)'
            }}
          >
            {challenge.code}
          </div>
          <motion.button
            onClick={throttledCopyCode}
            aria-label={copied ? (t.copied || 'Copied') : (t.copyCode || 'Copy code')}
            className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center transition-all",
              copied
                ? "bg-emerald-500/20 border border-emerald-500/40"
                : "bg-foreground/5 border border-foreground/10 hover:bg-foreground/10"
            )}
            style={copied ? { boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' } : undefined}
            whileHover={{ scale: 1.05 }}
            whileTap={zenTap.button}
          >
            {copied ? (
              <Check className="w-6 h-6 text-emerald-400" />
            ) : (
              <Copy className="w-6 h-6 text-slate-600 dark:text-white/70" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={handleDelete}
          className="h-12"
        >
          <Trash2 className="w-4 h-4 me-2" />
          {t.delete || 'Delete'}
        </Button>

        <Button
          onClick={throttledShare}
          disabled={isSharing}
          className="h-12"
        >
          <Share2 className="w-4 h-4 me-2" />
          {isSharing ? t.sharing || 'Sharing...' : t.shareButton || 'Share'}
        </Button>
      </div>
    </div>
  );
}
