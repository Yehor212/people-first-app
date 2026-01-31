/**
 * Quick Actions Bar Component
 * Shows pending notifications, challenges, and quick actions
 */

import { useState, useEffect } from 'react';
import { Bell, Zap, Clock, Gift, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { TimeChallenge, ADHDNotification } from '@/lib/adhdHooks';

interface QuickActionsBarProps {
  challenges?: TimeChallenge[];
  notifications?: ADHDNotification[];
  spinTokens?: number;
  hasUnclaimedReward?: boolean;
  onOpenChallenge?: (challenge: TimeChallenge) => void;
  onDismissNotification?: (id: string) => void;
  onOpenDailyRewards?: () => void;
  onOpenSpinWheel?: () => void;
}

export function QuickActionsBar({
  challenges = [],
  notifications = [],
  spinTokens = 0,
  hasUnclaimedReward = false,
  onOpenChallenge,
  onDismissNotification,
  onOpenDailyRewards,
  onOpenSpinWheel,
}: QuickActionsBarProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  // Active challenges (not expired, not completed)
  const activeChallenges = challenges.filter(
    c => !c.completed && c.expiresAt > Date.now()
  );

  // Update time left for challenges
  useEffect(() => {
    const updateTimes = () => {
      const newTimes: Record<string, string> = {};
      activeChallenges.forEach(c => {
        const remaining = c.expiresAt - Date.now();
        if (remaining > 0) {
          const hours = Math.floor(remaining / 3600000);
          const minutes = Math.floor((remaining % 3600000) / 60000);
          if (hours > 0) {
            newTimes[c.id] = `${hours}h ${minutes}m`;
          } else {
            newTimes[c.id] = `${minutes}m`;
          }
        }
      });
      setTimeLeft(newTimes);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 60000);
    return () => clearInterval(interval);
  }, [activeChallenges]);

  // Nothing to show
  if (
    activeChallenges.length === 0 &&
    notifications.length === 0 &&
    !hasUnclaimedReward &&
    spinTokens === 0
  ) {
    return null;
  }

  const totalItems = activeChallenges.length + notifications.length +
    (hasUnclaimedReward ? 1 : 0) + (spinTokens > 0 ? 1 : 0);

  return (
    <div className="mb-4 animate-fade-in">
      {/* Collapsed View - Single Line */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-3 hover:from-primary/10 hover:to-accent/10 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-primary" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-sm font-medium">
              {totalItems} {totalItems === 1 ? 'action' : 'actions'} pending
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="bg-card rounded-2xl p-4 zen-shadow-card space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Quick Actions
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2.5 hover:bg-muted rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Daily Rewards */}
          {hasUnclaimedReward && onOpenDailyRewards && (
            <button
              onClick={onOpenDailyRewards}
              className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl hover:from-pink-500/20 hover:to-purple-500/20 transition-all"
            >
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <Gift className="w-5 h-5 text-pink-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{t.dailyRewards || 'Daily Rewards'}</div>
                <div className="text-xs text-muted-foreground">
                  {t.claim || 'Claim your reward!'}
                </div>
              </div>
              <div className="px-2 py-1 bg-pink-500 text-white text-xs font-bold rounded-full animate-pulse">
                NEW
              </div>
            </button>
          )}

          {/* Spin Wheel */}
          {spinTokens > 0 && onOpenSpinWheel && (
            <button
              onClick={onOpenSpinWheel}
              className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl hover:from-yellow-500/20 hover:to-orange-500/20 transition-all"
            >
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{t.spinWheel || 'Spin the Wheel!'}</div>
                <div className="text-xs text-muted-foreground">
                  {spinTokens} {t.spinsAvailable || 'spins available'}
                </div>
              </div>
              <div className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                x{spinTokens}
              </div>
            </button>
          )}

          {/* Active Challenges */}
          {activeChallenges.map(challenge => (
            <button
              key={challenge.id}
              onClick={() => onOpenChallenge?.(challenge)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
                challenge.type === 'flash'
                  ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 hover:from-red-500/20 hover:to-orange-500/20'
                  : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg',
                challenge.type === 'flash' ? 'bg-red-500/20' : 'bg-blue-500/20'
              )}>
                <span className="text-xl">{challenge.icon}</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{challenge.title}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        challenge.type === 'flash' ? 'bg-red-500' : 'bg-blue-500'
                      )}
                      style={{ width: `${(challenge.progress / challenge.target) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {challenge.progress}/{challenge.target}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {timeLeft[challenge.id] || '...'}
              </div>
            </button>
          ))}

          {/* Notifications */}
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl',
                notification.type === 'warning'
                  ? 'bg-yellow-500/10'
                  : notification.type === 'success'
                  ? 'bg-green-500/10'
                  : 'bg-primary/10'
              )}
            >
              <span className="text-xl">{notification.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{notification.title}</div>
                <div className="text-xs text-muted-foreground">{notification.message}</div>
              </div>
              {onDismissNotification && (
                <button
                  onClick={() => onDismissNotification(notification.id)}
                  className="p-2.5 hover:bg-muted rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
