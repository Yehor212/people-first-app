/**
 * ChallengeModal - Modal for creating and managing friend challenges
 * Part of v1.4.0 Social & Sharing
 */

import { useState, useEffect, useMemo, memo } from 'react';
import {
  X,
  Share2,
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticSuccess, hapticTap, hapticWarning } from '@/lib/haptics';
import { Habit } from '@/types';
import {
  Challenge,
  ChallengeInvite,
  CHALLENGE_DURATIONS,
  createChallenge,
  getActiveChallenges,
  getAllChallenges,
  shareChallenge,
  getChallengeProgress,
  getDaysRemaining,
  deleteChallenge,
  joinChallenge,
  joinChallengeByCode,
} from '@/lib/friendChallenge';

// ============================================
// TYPES
// ============================================

type ModalMode = 'create' | 'list' | 'details' | 'join';

interface ChallengeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: Habit; // If provided, opens in create mode for this habit
  username?: string;
  initialInvite?: ChallengeInvite; // If provided, opens in join mode with pre-filled data
}

// ============================================
// CHALLENGE CARD COMPONENT
// ============================================

function ChallengeCard({
  challenge,
  onClick,
  t,
}: {
  challenge: Challenge;
  onClick: () => void;
  t: Record<string, string>;
}) {
  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  const statusConfig = {
    active: {
      bg: 'bg-gradient-to-r from-emerald-500/80 to-teal-500/80',
      glow: 'rgba(16, 185, 129, 0.4)',
      progressBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    },
    completed: {
      bg: 'bg-gradient-to-r from-amber-500/80 to-orange-500/80',
      glow: 'rgba(245, 158, 11, 0.4)',
      progressBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    },
    expired: {
      bg: 'bg-muted-foreground/50',
      glow: 'transparent',
      progressBg: 'bg-muted-foreground/50',
    },
  }[challenge.status];

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative w-full p-4 rounded-2xl text-left overflow-hidden",
        "bg-slate-100/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200/60 dark:border-white/10",
        "hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all"
      )}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Gradient accent on left */}
      <div
        className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-600"
        style={{ boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)' }}
      />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex items-center gap-3">
          <div
            className="text-3xl p-2 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
            }}
          >
            {challenge.habitIcon}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{challenge.habitName}</p>
            <p className="text-xs text-slate-500 dark:text-white/60">
              {challenge.isCreator
                ? t.youCreated || 'You created this'
                : `${t.createdBy || 'Created by'} ${challenge.creatorName || t.friend || 'a friend'}`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/40 flex-shrink-0" />
      </div>

      {/* Progress bar - Premium */}
      <div className="mt-3 pl-2">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500 dark:text-white/60">
            {challenge.myProgress}/{challenge.duration} {t.days || 'days'}
          </span>
          <span
            className={cn('px-2.5 py-1 rounded-full text-white text-xs font-medium', statusConfig.bg)}
            style={{ boxShadow: `0 0 12px ${statusConfig.glow}` }}
          >
            {challenge.status === 'active'
              ? `${daysLeft} ${t.daysLeft || 'days left'}`
              : challenge.status === 'completed'
                ? t.completed || 'Completed!'
                : t.expired || 'Expired'}
          </span>
        </div>
        <div className="h-2.5 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', statusConfig.progressBg)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ boxShadow: `0 0 8px ${statusConfig.glow}` }}
          />
        </div>
      </div>
    </motion.button>
  );
}

// ============================================
// CREATE CHALLENGE VIEW
// ============================================

function CreateChallengeView({
  habit,
  username,
  onCreated,
  t,
}: {
  habit: Habit;
  username?: string;
  onCreated: (challenge: Challenge) => void;
  t: Record<string, string>;
}) {
  const [duration, setDuration] = useState(7);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    hapticTap();
    setIsCreating(true);

    const challenge = createChallenge(habit, duration, username);

    // Small delay for effect
    await new Promise(resolve => setTimeout(resolve, 300));

    hapticSuccess();
    onCreated(challenge);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Habit preview - Premium */}
      <motion.div
        className="flex items-center gap-4 p-4 rounded-2xl overflow-hidden relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div
          className="text-5xl p-3 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          }}
        >
          {habit.icon}
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-white text-lg">{habit.name}</p>
          <p className="text-sm text-slate-500 dark:text-white/60">
            {t.challengeYourFriends || 'Challenge your friends to this habit!'}
          </p>
        </div>
      </motion.div>

      {/* Duration selector - Premium */}
      <div>
        <label className="text-sm font-medium text-slate-600 dark:text-white/80 mb-3 block">
          {t.challengeDuration || 'Challenge Duration'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CHALLENGE_DURATIONS.map((opt, index) => (
            <motion.button
              key={opt.value}
              onClick={() => {
                hapticTap();
                setDuration(opt.value);
              }}
              className={cn(
                'p-4 rounded-xl transition-all',
                duration === opt.value
                  ? 'bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40'
                  : 'bg-slate-100/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:bg-slate-200/60 dark:hover:bg-white/10'
              )}
              style={duration === opt.value ? {
                boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
              } : undefined}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={cn(
                "text-2xl font-bold",
                duration === opt.value ? "text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-white"
              )}>{opt.value}</div>
              <div className={cn(
                "text-xs",
                duration === opt.value ? "text-violet-700/70 dark:text-violet-300/70" : "text-slate-500 dark:text-white/50"
              )}>{t.days || 'days'}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Create button - Premium */}
      <motion.button
        onClick={handleCreate}
        disabled={isCreating}
        className={cn(
          "relative w-full h-14 rounded-xl font-semibold text-lg text-white overflow-hidden",
          isCreating
            ? "bg-white/10 cursor-not-allowed"
            : "bg-gradient-to-r from-violet-500 to-purple-600"
        )}
        style={!isCreating ? {
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
        } : undefined}
        whileHover={!isCreating ? { scale: 1.02 } : {}}
        whileTap={!isCreating ? { scale: 0.98 } : {}}
      >
        {/* Pulse ring */}
        {!isCreating && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-violet-400/30"
            animate={{ scale: [1, 1.05], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isCreating ? (
            <span className="animate-pulse">{t.creating || 'Creating...'}</span>
          ) : (
            <>
              <Users className="w-5 h-5" />
              {t.createChallenge || 'Create Challenge'}
            </>
          )}
        </span>
      </motion.button>

      <p className="text-xs text-center text-slate-400 dark:text-white/40">
        {t.challengeShareTip || "You'll be able to share this challenge with friends after creating it."}
      </p>
    </div>
  );
}

// ============================================
// CHALLENGE DETAILS VIEW
// ============================================

function ChallengeDetailsView({
  challenge,
  onBack,
  onDelete,
  t,
}: {
  challenge: Challenge;
  onBack: () => void;
  onDelete: () => void;
  t: Record<string, string>;
}) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  // Calculate statistics
  const daysPassed = challenge.duration - daysLeft;
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

  const handleShare = async () => {
    hapticTap();
    setIsSharing(true);

    const success = await shareChallenge(challenge, t);

    if (success) {
      hapticSuccess();
    }

    setIsSharing(false);
  };

  const handleCopyCode = async () => {
    hapticTap();

    try {
      await navigator.clipboard.writeText(challenge.code);
      setCopied(true);
      hapticSuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticWarning();
    }
  };

  const handleDelete = () => {
    hapticWarning();
    if (confirm(t.confirmDeleteChallenge || 'Delete this challenge?')) {
      deleteChallenge(challenge.id);
      onDelete();
    }
  };

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
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)' }}
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
            onClick={handleCopyCode}
            className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center transition-all",
              copied
                ? "bg-emerald-500/20 border border-emerald-500/40"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            )}
            style={copied ? { boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' } : undefined}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
          <Trash2 className="w-4 h-4 mr-2" />
          {t.delete || 'Delete'}
        </Button>

        <Button
          onClick={handleShare}
          disabled={isSharing}
          className="h-12"
        >
          <Share2 className="w-4 h-4 mr-2" />
          {isSharing ? t.sharing || 'Sharing...' : t.shareButton || 'Share'}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// CHALLENGES LIST VIEW
// ============================================

function ChallengesListView({
  onSelectChallenge,
  onJoinChallenge,
  t,
}: {
  onSelectChallenge: (challenge: Challenge) => void;
  onJoinChallenge: () => void;
  t: Record<string, string>;
}) {
  const challenges = useMemo(() => getAllChallenges(), []);

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const expiredChallenges = challenges.filter(c => c.status === 'expired');

  if (challenges.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-5xl mb-4">🤝</div>
        <p className="text-muted-foreground">
          {t.noChallenges || 'No challenges yet'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t.createChallengePrompt || 'Create a challenge from any habit!'}
        </p>

        {/* Join button for empty state */}
        <Button
          onClick={onJoinChallenge}
          variant="outline"
          className="mt-6"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {t.joinChallenge || 'Join Challenge'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Join button at top */}
      <Button
        onClick={onJoinChallenge}
        variant="outline"
        className="w-full h-12"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {t.joinChallenge || 'Join Challenge'}
      </Button>

      {/* Active challenges */}
      {activeChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--mood-good))]" />
            {t.activeChallenges || 'Active Challenges'}
          </h3>
          <div className="space-y-2">
            {activeChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed challenges */}
      {completedChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            {t.completedChallenges || 'Completed'}
          </h3>
          <div className="space-y-2">
            {completedChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expired challenges */}
      {expiredChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {t.expiredChallenges || 'Expired'}
          </h3>
          <div className="space-y-2 opacity-60">
            {expiredChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// JOIN CHALLENGE VIEW
// ============================================

function JoinChallengeView({
  initialInvite,
  onJoined,
  onCancel,
  t,
}: {
  initialInvite?: ChallengeInvite;
  onJoined: (challenge: Challenge) => void;
  onCancel: () => void;
  t: Record<string, string>;
}) {
  const [code, setCode] = useState(initialInvite?.code || '');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Auto-format code as user types (add dash after ZEN)
  const handleCodeChange = (value: string) => {
    // Remove any non-alphanumeric characters except dash
    let cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    // Auto-add ZEN- prefix if user starts typing without it
    if (cleaned.length > 0 && !cleaned.startsWith('ZEN')) {
      cleaned = 'ZEN-' + cleaned.replace(/-/g, '');
    }

    // Ensure dash after ZEN
    if (cleaned.startsWith('ZEN') && cleaned.length > 3 && cleaned[3] !== '-') {
      cleaned = 'ZEN-' + cleaned.slice(3).replace(/-/g, '');
    }

    // Limit to ZEN-XXXXXX format
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }

    setCode(cleaned);
    setError('');
  };

  const handleJoin = async () => {
    hapticTap();
    setError('');

    // If we have full invite data, use it
    if (initialInvite && initialInvite.habitName) {
      setIsJoining(true);
      const challenge = joinChallenge(initialInvite);
      await new Promise(resolve => setTimeout(resolve, 300));
      hapticSuccess();
      onJoined(challenge);
      return;
    }

    // Otherwise, join by code only
    const challenge = joinChallengeByCode(code);

    if (!challenge) {
      setError(t.invalidChallengeCode || 'Invalid code. Format: ZEN-XXXXXX');
      hapticWarning();
      return;
    }

    setIsJoining(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    hapticSuccess();
    onJoined(challenge);
  };

  const isValidCode = /^ZEN-[A-Z0-9]{6}$/.test(code);

  return (
    <div className="space-y-6 pb-8">
      {/* Header illustration */}
      <div className="text-center py-6 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl">
        <div className="text-6xl mb-3">🤝</div>
        <h3 className="text-xl font-bold text-foreground">
          {t.joinChallenge || 'Join Challenge'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t.enterChallengeCode || 'Enter the code from your friend'}
        </p>
      </div>

      {/* Show invite preview if we have full data */}
      {initialInvite && initialInvite.habitName && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl">
          <div className="text-4xl">{initialInvite.habitIcon}</div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{initialInvite.habitName}</p>
            <p className="text-sm text-muted-foreground">
              {initialInvite.duration} {t.days || 'days'} • {initialInvite.creatorName || t.friend || 'Friend'}
            </p>
          </div>
        </div>
      )}

      {/* Code input */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t.challengeCode || 'Challenge Code'}
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="ZEN-XXXXXX"
          className={cn(
            'w-full px-4 py-4 rounded-xl border-2 text-center text-xl font-mono tracking-widest',
            'bg-card focus:outline-none transition-colors',
            error
              ? 'border-destructive focus:border-destructive'
              : isValidCode
                ? 'border-[hsl(var(--mood-good))] focus:border-[hsl(var(--mood-good))]'
                : 'border-border focus:border-primary'
          )}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          disabled={!!initialInvite?.habitName}
        />
        {error && (
          <p className="text-sm text-destructive mt-2 text-center">{error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="h-14"
          disabled={isJoining}
        >
          {t.cancel || 'Cancel'}
        </Button>

        <Button
          onClick={handleJoin}
          disabled={!isValidCode || isJoining}
          className="h-14 text-lg font-semibold"
        >
          {isJoining ? (
            <span className="animate-pulse">{t.joining || 'Joining...'}</span>
          ) : (
            <>
              <UserPlus className="w-5 h-5 mr-2" />
              {t.join || 'Join'}
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        {t.joinChallengeHint || 'Ask your friend to share their challenge code with you'}
      </p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export const ChallengeModal = memo(function ChallengeModal({
  open,
  onOpenChange,
  habit,
  username,
  initialInvite,
}: ChallengeModalProps) {
  const { t } = useLanguage();

  const [mode, setMode] = useState<ModalMode>(habit ? 'create' : 'list');
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [newlyCreatedChallenge, setNewlyCreatedChallenge] = useState<Challenge | null>(null);
  const [pendingInvite, setPendingInvite] = useState<ChallengeInvite | undefined>(undefined);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // If we have an invite, go to join mode
      if (initialInvite) {
        setPendingInvite(initialInvite);
        setMode('join');
      } else {
        setPendingInvite(undefined);
        setMode(habit ? 'create' : 'list');
      }
      setSelectedChallenge(null);
      setNewlyCreatedChallenge(null);
    }
  }, [open, habit, initialInvite]);

  const handleChallengeCreated = (challenge: Challenge) => {
    setNewlyCreatedChallenge(challenge);
    setSelectedChallenge(challenge);
    setMode('details');
  };

  const handleChallengeJoined = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setPendingInvite(undefined);
    setMode('details');
  };

  const handleSelectChallenge = (challenge: Challenge) => {
    hapticTap();
    setSelectedChallenge(challenge);
    setMode('details');
  };

  const handleJoinMode = () => {
    hapticTap();
    setPendingInvite(undefined);
    setMode('join');
  };

  const handleBack = () => {
    hapticTap();
    setSelectedChallenge(null);
    setNewlyCreatedChallenge(null);
    setPendingInvite(undefined);
    setMode('list');
  };

  const getTitle = (): string => {
    switch (mode) {
      case 'create':
        return t.createChallenge || 'Create Challenge';
      case 'join':
        return t.joinChallenge || 'Join Challenge';
      case 'details':
        return newlyCreatedChallenge
          ? t.challengeCreated || 'Challenge Created!'
          : t.challengeDetails || 'Challenge Details';
      default:
        return t.friendChallenges || 'Friend Challenges';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            {(mode === 'details' || mode === 'join') && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
              >
                ←
              </button>
            )}
            <SheetTitle className={cn(
              "text-center flex-1",
              (mode === 'details' || mode === 'join') && 'text-left'
            )}>
              {getTitle()}
            </SheetTitle>
            {(mode === 'details' || mode === 'join') && <div className="w-8" />}
          </div>
          <SheetDescription className="text-center text-sm">
            {mode === 'create'
              ? t.challengeDescription || 'Challenge friends to build habits together'
              : mode === 'join'
                ? t.enterCodeToJoin || 'Enter a challenge code to join your friends'
                : mode === 'details' && newlyCreatedChallenge
                  ? t.shareToInvite || 'Share to invite friends!'
                  : t.trackWithFriends || 'Track your challenges with friends'}
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
          {mode === 'create' && habit && (
            <CreateChallengeView
              habit={habit}
              username={username}
              onCreated={handleChallengeCreated}
              t={t}
            />
          )}

          {mode === 'list' && (
            <ChallengesListView
              onSelectChallenge={handleSelectChallenge}
              onJoinChallenge={handleJoinMode}
              t={t}
            />
          )}

          {mode === 'join' && (
            <JoinChallengeView
              initialInvite={pendingInvite}
              onJoined={handleChallengeJoined}
              onCancel={handleBack}
              t={t}
            />
          )}

          {mode === 'details' && selectedChallenge && (
            <ChallengeDetailsView
              challenge={selectedChallenge}
              onBack={handleBack}
              onDelete={handleBack}
              t={t}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

export default ChallengeModal;
