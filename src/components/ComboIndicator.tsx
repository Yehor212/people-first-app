/**
 * Combo Indicator Component
 * Shows combo multiplier with animated effects
 */

import { useEffect, useState } from 'react';
import { Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComboState, getComboMessage, formatTimeRemaining } from '@/lib/adhdHooks';
import { PremiumIcon } from '@/components/icons';

interface ComboIndicatorProps {
  combo: ComboState;
  className?: string;
}

export function ComboIndicator({ combo, className }: ComboIndicatorProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiring, setIsExpiring] = useState(false);

  useEffect(() => {
    if (combo.count === 0 || combo.expiresAt === 0) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = combo.expiresAt - now;

      if (diff <= 0) {
        setTimeLeft('');
        return;
      }

      setTimeLeft(formatTimeRemaining(combo.expiresAt));
      setIsExpiring(diff < 30000); // Last 30 seconds
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [combo.expiresAt, combo.count]);

  if (combo.count < 2) return null;

  const message = getComboMessage(combo.count);
  const isMaxCombo = combo.count >= 10;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-40 animate-slide-up',
        className
      )}
    >
      <div
        className={cn(
          'relative rounded-2xl p-3 pr-4 shadow-xl transition-all',
          isMaxCombo
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-orange-500/50'
            : combo.count >= 5
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/50'
            : 'bg-gradient-to-r from-primary to-primary/80 text-white',
          isExpiring && 'animate-pulse'
        )}
      >
        {/* Fire animation for high combos */}
        {combo.count >= 5 && (
          <div className="absolute -top-3 -right-1">
            <Flame
              className={cn(
                'w-6 h-6',
                isMaxCombo ? 'text-yellow-300 animate-bounce' : 'text-orange-300'
              )}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Combo count */}
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl font-bold text-lg',
            isMaxCombo ? 'bg-white/30' : 'bg-white/20'
          )}>
            {combo.count}x
          </div>

          <div className="flex flex-col">
            {/* Message */}
            {message ? (
              <span className="font-bold text-sm flex items-center gap-1">
                {message.emoji} {message.text}
              </span>
            ) : (
              <span className="font-bold text-sm">
                COMBO x{combo.count}
              </span>
            )}

            {/* Multiplier & Timer */}
            <div className="flex items-center gap-2 text-xs opacity-90">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {combo.multiplier}x XP
              </span>
              {timeLeft && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded',
                  isExpiring ? 'bg-red-500/50 animate-pulse' : 'bg-white/20'
                )}>
                  {timeLeft}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar to next combo level */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 rounded-b-2xl overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              isMaxCombo ? 'bg-yellow-300' : 'bg-white/60'
            )}
            style={{
              width: `${Math.min((combo.count % 3) / 3 * 100 + 33, 100)}%`
            }}
          />
        </div>
      </div>

      {/* Bonus XP indicator */}
      {combo.bonusXp > 0 && (
        <div className="mt-2 text-center">
          <span className={cn(
            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
            isMaxCombo
              ? 'bg-yellow-500/20 text-yellow-600'
              : 'bg-primary/20 text-primary'
          )}>
            <Zap className="w-3 h-3" />
            +{combo.bonusXp} Bonus XP!
          </span>
        </div>
      )}
    </div>
  );
}

// Compact version for header
export function ComboIndicatorCompact({ combo }: ComboIndicatorProps) {
  if (combo.count < 2) return null;

  const isMaxCombo = combo.count >= 10;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold',
        isMaxCombo
          ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white animate-pulse'
          : combo.count >= 5
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          : 'bg-primary/20 text-primary'
      )}
    >
      {combo.count >= 5 && <Flame className="w-3 h-3" />}
      {combo.count}x
      {isMaxCombo && <PremiumIcon name="fire" size="xs" />}
    </div>
  );
}
