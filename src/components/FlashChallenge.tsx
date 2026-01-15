/**
 * Flash Challenge Component
 * Time-limited urgent challenges for ADHD engagement
 */

import { useState, useEffect } from 'react';
import { Clock, Zap, X, Trophy, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { TimeChallenge, formatTimeRemaining, shouldShowUrgentPrompt } from '@/lib/adhdHooks';

interface FlashChallengeProps {
  challenge: TimeChallenge;
  onComplete: (xpReward: number) => void;
  onDismiss: () => void;
}

export function FlashChallenge({ challenge, onComplete, onDismiss }: FlashChallengeProps) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(challenge.expiresAt));
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      if (now >= challenge.expiresAt) {
        setIsExpired(true);
        return;
      }

      setTimeLeft(formatTimeRemaining(challenge.expiresAt));
      setIsUrgent(shouldShowUrgentPrompt(challenge.expiresAt));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [challenge.expiresAt]);

  useEffect(() => {
    if (challenge.progress >= challenge.target && !challenge.completed) {
      onComplete(challenge.xpReward);
    }
  }, [challenge.progress, challenge.target, challenge.completed, challenge.xpReward, onComplete]);

  const progress = Math.min((challenge.progress / challenge.target) * 100, 100);

  if (isExpired && !challenge.completed) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-red-600">{t.challengeExpired || 'Challenge Expired'}</div>
            <div className="text-sm text-red-500/80">{challenge.title}</div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    );
  }

  if (challenge.completed) {
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-4 animate-scale-in">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-xl">
            <Trophy className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-green-600">{t.challengeComplete || 'Challenge Complete!'}</div>
            <div className="text-sm text-green-500/80">
              +{challenge.xpReward} XP {t.earned || 'earned'}! 🎉
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-green-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl p-4 transition-all',
        isUrgent
          ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/50 animate-pulse'
          : challenge.type === 'flash'
          ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30'
          : challenge.type === 'hourly'
          ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30'
          : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'p-2 rounded-xl',
          isUrgent ? 'bg-red-500/20' : 'bg-yellow-500/20'
        )}>
          {isUrgent ? (
            <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
          ) : (
            <Zap className="w-5 h-5 text-yellow-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold">{challenge.title}</span>
            {isUrgent && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
                HURRY!
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{challenge.description}</p>

          {/* Progress bar */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className={cn(
                'h-full transition-all duration-500',
                isUrgent
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              )}
              style={{ width: `${progress}%` }}
            />
            {progress > 0 && progress < 100 && (
              <div
                className="absolute top-0 h-full w-2 bg-white/50 animate-pulse"
                style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
              />
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {challenge.progress}/{challenge.target}
            </span>
            <div className="flex items-center gap-3">
              <span className={cn(
                'flex items-center gap-1 font-medium',
                isUrgent ? 'text-red-500' : 'text-muted-foreground'
              )}>
                <Clock className="w-4 h-4" />
                {timeLeft}
              </span>
              <span className="flex items-center gap-1 text-yellow-600 font-bold">
                <Zap className="w-4 h-4" />
                +{challenge.xpReward} XP
              </span>
            </div>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-muted rounded-lg transition-colors opacity-60 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Compact version for sidebar/notifications
export function FlashChallengeCompact({ challenge, onClick }: { challenge: TimeChallenge; onClick: () => void }) {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(challenge.expiresAt));
  const isUrgent = shouldShowUrgentPrompt(challenge.expiresAt);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(challenge.expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge.expiresAt]);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all hover:scale-[1.02]',
        isUrgent
          ? 'bg-red-500/20 border border-red-500/50 animate-pulse'
          : 'bg-yellow-500/10 border border-yellow-500/30'
      )}
    >
      <span className="text-lg">{challenge.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{challenge.title}</div>
        <div className={cn(
          'text-xs flex items-center gap-1',
          isUrgent ? 'text-red-500' : 'text-muted-foreground'
        )}>
          <Clock className="w-3 h-3" />
          {timeLeft}
        </div>
      </div>
      <Zap className={cn('w-4 h-4', isUrgent ? 'text-red-500' : 'text-yellow-500')} />
    </button>
  );
}
