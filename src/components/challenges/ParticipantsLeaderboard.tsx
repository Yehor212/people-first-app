/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The bounded participants region must receive focus for keyboard scrolling. */
import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Challenge } from '@/lib/friendChallenge';
import {
  isCloudChallengesAvailable,
  syncLocalChallengeToCloud,
  getChallengeLeaderboard as getCloudLeaderboard,
  subscribeToChallenge,
} from '@/lib/challengeService';
import type { ChallengeLeaderboard } from '@/types/challenges';

export function ParticipantsLeaderboard({
  challenge,
  t,
  username,
}: {
  challenge: Challenge;
  t: Record<string, string>;
  username?: string;
}) {
  const [leaderboard, setLeaderboard] = useState<ChallengeLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Check if cloud is available
  const cloudAvailable = isCloudChallengesAvailable();

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First, sync local challenge to cloud
      const cloudChallenge = await syncLocalChallengeToCloud(
        challenge.code,
        challenge.habitName,
        challenge.habitIcon,
        challenge.duration,
        challenge.startDate,
        username || 'Zen User'
      );

      if (!cloudChallenge) {
        setError(t.cloudSyncError || 'Could not update challenge online');
        setLoading(false);
        return;
      }

      // Get leaderboard
      const data = await getCloudLeaderboard(cloudChallenge.id);
      setLeaderboard(data);
    } catch (_err) {
      setError(t.leaderboardError || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.code, challenge.habitName, challenge.habitIcon, challenge.duration, challenge.startDate, username]);

  useEffect(() => {
    if (!cloudAvailable) {
      setLoading(false);
      return;
    }

    void loadLeaderboard();
  }, [cloudAvailable, loadLeaderboard]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!cloudAvailable || !leaderboard?.challenge?.id) return;

    const unsubscribe = subscribeToChallenge(leaderboard.challenge.id, (members) => {
      setLeaderboard(prev => prev ? { ...prev, members } : null);
    });

    return () => unsubscribe();
  }, [cloudAvailable, leaderboard?.challenge?.id]);

  // Not available in local-only mode
  if (!cloudAvailable) {
    return (
      <motion.div
        className="rounded-2xl p-5 text-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]"
        data-testid="challenge-participants"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CloudOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t.participantsLocalOnly || 'Sign in to see other participants'}
        </p>
      </motion.div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <motion.div
        className="rounded-2xl p-5 text-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]"
        data-testid="challenge-participants"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Loader2 className="mx-auto mb-2 h-6 w-6 text-primary motion-safe:animate-spin" aria-label={t.loadingParticipants || 'Loading participants...'} />
        <p className="text-sm text-muted-foreground">{t.loadingParticipants || 'Loading participants...'}</p>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        className="rounded-2xl p-5 text-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]"
        data-testid="challenge-participants"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={() => void loadLeaderboard()} variant="ghost" size="sm" className="mt-2">
          {t.retry || 'Retry'}
        </Button>
      </motion.div>
    );
  }

  // No participants yet
  if (!leaderboard || leaderboard.members.length === 0) {
    return (
      <motion.div
        className="rounded-2xl p-5 text-center bg-[linear-gradient(135deg,rgba(139,92,246,0.1)_0%,rgba(168,85,247,0.05)_100%)]"
        data-testid="challenge-participants"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Users className="w-8 h-8 mx-auto mb-2 text-violet-400" />
        <p className="text-sm text-muted-foreground">
          {t.noParticipantsYet || 'Share your challenge code to invite friends!'}
        </p>
      </motion.div>
    );
  }

  // Leaderboard
  return (
    <motion.div
      className="rounded-2xl overflow-hidden bg-[linear-gradient(135deg,rgba(139,92,246,0.1)_0%,rgba(168,85,247,0.05)_100%)] shadow-[0_0_20px_rgba(139,92,246,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]"
      data-testid="challenge-participants"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 border-b border-foreground/10 px-5 py-3">
        <Users className="col-start-1 row-start-1 h-4 w-4 shrink-0 text-violet-400" />
        <span className="col-span-3 row-start-2 min-w-0 whitespace-normal text-sm font-medium text-slate-800 [overflow-wrap:normal] [word-break:normal] dark:text-white min-[420px]:col-span-1 min-[420px]:col-start-2 min-[420px]:row-start-1">
          <span>{t.participants || 'Participants'}</span>{' '}
          <bdi dir="ltr">({leaderboard.members.length})</bdi>
        </span>
        <Cloud className="col-start-3 row-start-1 h-3 w-3 shrink-0 justify-self-end text-emerald-400" />
      </div>

      <div
        aria-label={t.participants || 'Participants'}
        className="max-h-[12.5rem] overflow-y-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        role="region"
        tabIndex={0}
      >
        <div className="space-y-1" role="list">
          {/* Add empty state check before map */}
          {(!leaderboard.members || leaderboard.members.length === 0) ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
              {t.noParticipantsYet || 'No participants yet'}
            </div>
          ) : leaderboard.members.map((member, index) => (
            <motion.div
              key={member.id}
              initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { delay: index * 0.05 }
              }
              role="listitem"
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl p-3 min-[420px]:grid-cols-[2rem_minmax(0,1fr)_auto]",
                member.isCurrentUser
                  ? "bg-violet-500/20 border border-violet-500/30"
                  : "bg-foreground/5"
              )}
            >
            {/* Rank */}
            <div className="w-8 text-center font-bold text-lg">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </div>

            {/* Name */}
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                <span className={cn(
                  "block min-w-0 whitespace-normal [overflow-wrap:anywhere] font-medium leading-snug",
                  member.isCurrentUser ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-white"
                )}>
                  {member.displayName}
                </span>
                {member.isCurrentUser && (
                  <span className="shrink-0 text-xs text-violet-700 dark:text-violet-300">
                    <bdi dir="auto">({t.you || 'You'})</bdi>
                  </span>
                )}
              </div>
            </div>

            {/* Progress and completion stay associated in one full-width narrow row. */}
            <div className="col-span-2 row-start-2 flex min-w-0 items-start justify-between gap-3 min-[420px]:col-span-1 min-[420px]:col-start-3 min-[420px]:row-start-1 min-[420px]:justify-end">
              <div className="min-w-0 text-start min-[420px]:text-end">
                <div className="font-semibold text-slate-800 dark:text-white">
                  <bdi dir="ltr">
                    {member.daysCompleted}/{leaderboard.challenge.duration}
                  </bdi>
                </div>
                {member.currentStreak > 0 && (
                  <div className="text-xs text-amber-500">
                    <bdi dir="ltr">🔥 {member.currentStreak}</bdi>
                  </div>
                )}
              </div>

              {member.completed && (
                <CheckCircle2
                  aria-label={t.completed || 'Completed'}
                  className="h-5 w-5 shrink-0 text-emerald-500"
                  role="img"
                />
              )}
            </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
