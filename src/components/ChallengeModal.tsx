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

  const statusColor = {
    active: 'bg-emerald-500',
    completed: 'bg-amber-500',
    expired: 'bg-gray-400',
  }[challenge.status];

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-card rounded-xl border border-border/50 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{challenge.habitIcon}</div>
          <div>
            <p className="font-medium text-foreground">{challenge.habitName}</p>
            <p className="text-xs text-muted-foreground">
              {challenge.isCreator
                ? t.youCreated || 'You created this'
                : `${t.createdBy || 'Created by'} ${challenge.creatorName || t.friend || 'a friend'}`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {challenge.myProgress}/{challenge.duration} {t.days || 'days'}
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-white text-xs font-medium',
            statusColor
          )}>
            {challenge.status === 'active'
              ? `${daysLeft} ${t.daysLeft || 'days left'}`
              : challenge.status === 'completed'
                ? t.completed || 'Completed!'
                : t.expired || 'Expired'}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              challenge.status === 'completed'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </button>
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
      {/* Habit preview */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl">
        <div className="text-5xl">{habit.icon}</div>
        <div>
          <p className="font-semibold text-foreground text-lg">{habit.name}</p>
          <p className="text-sm text-muted-foreground">
            {t.challengeYourFriends || 'Challenge your friends to this habit!'}
          </p>
        </div>
      </div>

      {/* Duration selector */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t.challengeDuration || 'Challenge Duration'}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CHALLENGE_DURATIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                hapticTap();
                setDuration(opt.value);
              }}
              className={cn(
                'p-3 rounded-xl border-2 transition-all',
                duration === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              )}
            >
              <div className="text-2xl font-bold">{opt.value}</div>
              <div className="text-xs opacity-70">{t.days || 'days'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Create button */}
      <Button
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full h-14 text-lg font-semibold"
      >
        {isCreating ? (
          <span className="animate-pulse">{t.creating || 'Creating...'}</span>
        ) : (
          <>
            <Users className="w-5 h-5 mr-2" />
            {t.createChallenge || 'Create Challenge'}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
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
      {/* Header with icon */}
      <div className="text-center py-6 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl">
        <div className="text-6xl mb-3">{challenge.habitIcon}</div>
        <h3 className="text-xl font-bold text-foreground">{challenge.habitName}</h3>
        <p className="text-sm text-muted-foreground">
          {challenge.duration} {t.dayChallenge || 'day challenge'}
        </p>
      </div>

      {/* Progress section */}
      <div className="bg-card rounded-2xl p-4 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-foreground">
            {t.yourProgress || 'Your Progress'}
          </span>
          <span className="text-sm text-muted-foreground">
            {challenge.myProgress}/{challenge.duration} {t.days || 'days'}
          </span>
        </div>

        <div className="h-3 bg-secondary rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress}% {t.complete || 'complete'}</span>
          {challenge.status === 'active' && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLeft} {t.daysLeft || 'days left'}
            </span>
          )}
          {challenge.status === 'completed' && (
            <span className="flex items-center gap-1 text-amber-500">
              <Trophy className="w-3 h-3" />
              {t.challengeCompleted || 'Challenge Complete!'}
            </span>
          )}
        </div>
      </div>

      {/* Motivational message */}
      <div className={cn(
        'p-4 rounded-2xl text-center font-medium',
        challenge.status === 'completed'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : isAheadOfSchedule
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : isBehindSchedule
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
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
            <div className="text-2xl font-bold text-emerald-500">{challenge.myProgress}</div>
            <div className="text-xs text-muted-foreground">{t.daysCompleted || 'Completed'}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className="text-2xl font-bold text-foreground">{daysLeft}</div>
            <div className="text-xs text-muted-foreground">{t.daysRemaining || 'Remaining'}</div>
          </div>
        </div>
      )}

      {/* Challenge code */}
      <div className="bg-card rounded-2xl p-4 border border-border/50">
        <div className="text-sm font-medium text-foreground mb-2">
          {t.challengeCode || 'Challenge Code'}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg text-center tracking-wider">
            {challenge.code}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyCode}
            className="h-12 w-12"
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

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
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
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
            <Trophy className="w-4 h-4 text-amber-500" />
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
              ? 'border-red-500 focus:border-red-500'
              : isValidCode
                ? 'border-emerald-500 focus:border-emerald-500'
                : 'border-border focus:border-primary'
          )}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          disabled={!!initialInvite?.habitName}
        />
        {error && (
          <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
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
