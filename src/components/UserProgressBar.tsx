/**
 * User Progress Bar Component
 * Shows user level, XP progress, and quick stats in a compact bar
 */

import { useState, useEffect } from 'react';
import { Zap, Star, Gift, Flame, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDopamineSettings } from '@/components/DopamineSettings';

interface UserProgressBarProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  streak: number;
  spinTokens?: number;
  onOpenDailyRewards?: () => void;
  onOpenSpinWheel?: () => void;
}

export function UserProgressBar({
  level,
  currentXp,
  xpToNextLevel,
  streak,
  spinTokens = 0,
  onOpenDailyRewards,
  onOpenSpinWheel,
}: UserProgressBarProps) {
  const dopamine = useDopamineSettings();
  const [animatedXp, setAnimatedXp] = useState(currentXp);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [prevLevel, setPrevLevel] = useState(level);

  const progress = Math.min((animatedXp / xpToNextLevel) * 100, 100);

  // Animate XP changes
  useEffect(() => {
    if (!dopamine.animations) {
      setAnimatedXp(currentXp);
      return;
    }

    const duration = 500;
    const startXp = animatedXp;
    const diff = currentXp - startXp;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out
      const easedT = 1 - Math.pow(1 - t, 3);
      setAnimatedXp(Math.round(startXp + diff * easedT));

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [currentXp, dopamine.animations]);

  // Check for level up
  useEffect(() => {
    if (level > prevLevel) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    setPrevLevel(level);
  }, [level, prevLevel]);

  return (
    <div className="relative mb-6">
      {/* Level Up Animation */}
      {showLevelUp && dopamine.animations && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-yellow-500 text-white px-6 py-3 rounded-2xl font-bold text-lg animate-bounce shadow-lg">
            <Star className="w-5 h-5 inline mr-2" />
            Level Up! Level {level}
            <Star className="w-5 h-5 inline ml-2" />
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 zen-shadow-card">
        <div className="flex items-center justify-between mb-3">
          {/* Level Badge */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg',
              level < 10 ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' :
              level < 25 ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
              level < 50 ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' :
              level < 100 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
              'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white',
              dopamine.animations && 'transition-all duration-300'
            )}>
              {level}
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Level</div>
              <div className="flex items-center gap-1 text-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold">{animatedXp}</span>
                <span className="text-muted-foreground">/ {xpToNextLevel} XP</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Streak */}
            {streak > 0 && (
              <div className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-xl',
                streak >= 7 ? 'bg-orange-500/20 text-orange-600' : 'bg-muted'
              )}>
                <Flame className={cn(
                  'w-4 h-4',
                  streak >= 7 && dopamine.streakFire && 'animate-pulse text-orange-500'
                )} />
                <span className="font-bold text-sm">{streak}</span>
              </div>
            )}

            {/* Daily Rewards */}
            {onOpenDailyRewards && (
              <button
                onClick={onOpenDailyRewards}
                className={cn(
                  'p-2.5 rounded-xl transition-all',
                  'bg-gradient-to-br from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30',
                  dopamine.animations && 'hover:scale-105 active:scale-95'
                )}
              >
                <Gift className="w-5 h-5 text-pink-500" />
              </button>
            )}

            {/* Spin Wheel */}
            {onOpenSpinWheel && spinTokens > 0 && (
              <button
                onClick={onOpenSpinWheel}
                className={cn(
                  'p-2.5 rounded-xl transition-all relative',
                  'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30',
                  dopamine.animations && 'hover:scale-105 active:scale-95 hover:rotate-12'
                )}
              >
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {spinTokens}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              'bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]',
              dopamine.animations && 'transition-all duration-500 animate-gradient'
            )}
            style={{ width: `${progress}%` }}
          />
          {/* Shimmer effect */}
          {dopamine.animations && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
      </div>

      {/* Add keyframe animations to global styles if not present */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
