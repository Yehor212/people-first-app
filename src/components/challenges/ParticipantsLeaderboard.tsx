import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
        setError(t.cloudSyncError || 'Could not sync with cloud');
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
        initial={{ opacity: 0, y: 20 }}
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Loader2 className="w-6 h-6 mx-auto mb-2 text-primary animate-spin" aria-label={t.loadingParticipants || 'Loading participants...'} />
        <p className="text-sm text-muted-foreground">{t.loadingParticipants || 'Loading participants...'}</p>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        className="rounded-2xl p-5 text-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]"
        initial={{ opacity: 0, y: 20 }}
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
        initial={{ opacity: 0, y: 20 }}
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-5 py-3 border-b border-foreground/10 flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium text-slate-800 dark:text-white">
          {t.participants || 'Participants'} ({leaderboard.members.length})
        </span>
        <Cloud className="w-3 h-3 text-emerald-400 ms-auto" />
      </div>

      <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
        {/* Add empty state check before map */}
        {(!leaderboard.members || leaderboard.members.length === 0) ? (
          <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
            {t.noParticipantsYet || 'No participants yet'}
          </div>
        ) : leaderboard.members.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl",
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
            <div className="flex-1 min-w-0">
              <span className={cn(
                "font-medium truncate block",
                member.isCurrentUser ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-white"
              )}>
                {member.displayName}
                {member.isCurrentUser && ` (${t.you || 'You'})`}
              </span>
            </div>

            {/* Progress */}
            <div className="text-end">
              <div className="font-semibold text-slate-800 dark:text-white">
                {member.daysCompleted}/{leaderboard.challenge.duration}
              </div>
              {member.currentStreak > 0 && (
                <div className="text-xs text-amber-500">
                  🔥 {member.currentStreak}
                </div>
              )}
            </div>

            {/* Completion badge */}
            {member.completed && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
