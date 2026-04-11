/**
 * Daily Login Rewards Component
 * ADHD-optimized daily check-in with escalating rewards
 */

import { useState, useRef, useEffect } from "react";
import { Gift, Sparkles, Check, Lock, Zap, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn, getToday, formatDate } from "@/lib/utils";
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  storageGetRaw,
  storageSetRaw,
} from "@/lib/safeJson";
import { safeParseInt } from "@/lib/validation";
import { SK } from "@/lib/storageKeys";
import { RewardedAdPrompt } from "@/components/ads/RewardedAdPrompt";
import { useModalClose } from "@/hooks/useModalState";
import { useScrollLock } from "@/hooks/useScrollLock";
import { getDailyLoginRewards, getLoginStreakBonus, DailyLoginReward } from "@/lib/adhdHooks";

interface DailyRewardsProps {
  onClose: () => void;
  onClaimReward: (reward: DailyLoginReward["reward"], bonusXp: number) => void;
}

export function DailyRewards({ onClose, onClaimReward }: DailyRewardsProps) {
  const { t } = useLanguage();
  useModalClose(true, onClose);
  useScrollLock(true);

  const [rewards, setRewards] = useState<DailyLoginReward[]>(getDailyLoginRewards());
  const [currentDay, setCurrentDay] = useState(1);
  const [loginStreak, setLoginStreak] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Track mounted state and timeout to prevent memory leaks
  const mountedRef = useRef(true);
  const claimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (claimTimeoutRef.current) {
        clearTimeout(claimTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Load saved state
    const savedLogin = safeLocalStorageGet<{
      rewards?: DailyLoginReward[];
      currentDay?: number;
    }>(SK.DAILY_LOGIN, null);
    const savedStreak = storageGetRaw(SK.LOGIN_STREAK);
    const lastLogin = storageGetRaw(SK.LAST_LOGIN) || null;

    const today = getToday();
    const yesterday = formatDate(new Date(Date.now() - 86400000));

    if (savedLogin) {
      setRewards(savedLogin.rewards || getDailyLoginRewards());
      setCurrentDay(savedLogin.currentDay || 1);
    }

    if (savedStreak) {
      setLoginStreak(safeParseInt(savedStreak, 0, 0, 1000));
    }

    // Check if can claim today
    if (!lastLogin || lastLogin !== today) {
      setCanClaim(true);

      // Check if streak continues or resets
      if (lastLogin === yesterday) {
        // Continue streak
        const newStreak = safeParseInt(savedStreak, 0, 0, 1000) + 1;
        setLoginStreak(newStreak);
        storageSetRaw(SK.LOGIN_STREAK, String(newStreak));
      } else if (lastLogin && lastLogin !== today) {
        // Streak broken - reset
        setLoginStreak(1);
        storageSetRaw(SK.LOGIN_STREAK, "1");
        // Reset rewards cycle
        setCurrentDay(1);
        setRewards(getDailyLoginRewards());
      }
    }
  }, []);

  const handleClaim = () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    setShowConfetti(true);

    const reward = rewards[currentDay - 1];
    const bonusXp = getLoginStreakBonus(loginStreak);

    // Mark as claimed
    const updatedRewards = rewards.map((r, i) =>
      i === currentDay - 1 ? { ...r, claimed: true } : r
    );
    setRewards(updatedRewards);

    // Save state
    const nextDay = currentDay >= 7 ? 1 : currentDay + 1;
    safeLocalStorageSet(SK.DAILY_LOGIN, {
      rewards: nextDay === 1 ? getDailyLoginRewards() : updatedRewards,
      currentDay: nextDay,
    });
    storageSetRaw(SK.LAST_LOGIN, getToday());

    // Store timeout ref and check mounted before state update
    claimTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      onClaimReward(reward.reward, bonusXp);
      setCanClaim(false);
      setClaiming(false);
      setCurrentDay(nextDay);
    }, 1500);
  };

  const bonusXp = getLoginStreakBonus(loginStreak);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 lg:mx-auto lg:my-8 lg:max-w-2xl lg:rounded-2xl lg:shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={t.ariaDailyRewards}
    >
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            >
              {["🎉", "⭐", "✨", "🎊", "💫"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="zen-gradient p-6 text-white relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 end-4 p-2 hover:bg-foreground/20 rounded-full transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-foreground/20 rounded-2xl">
              <Gift className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t.dailyRewards || "Daily Rewards"}</h2>
              <p className="text-foreground/80 text-sm">
                {t.loginStreak || "Login Streak"}: {loginStreak} {t.days || "days"} 🔥
              </p>
            </div>
          </div>

          {/* Decorative sparkles */}
          <Sparkles className="absolute -right-4 -bottom-4 w-24 h-24 text-foreground/10" />
        </div>

        {/* Rewards Grid */}
        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-6">
            {rewards.map((reward, index) => {
              const isToday = index + 1 === currentDay;
              const isPast = index + 1 < currentDay || reward.claimed;
              const isFuture = index + 1 > currentDay && !reward.claimed;

              return (
                <div
                  key={index}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                    isToday && canClaim && "ring-2 ring-primary ring-offset-2 animate-pulse",
                    isPast && "bg-primary/10",
                    isFuture && "bg-muted opacity-60",
                    isToday && !canClaim && "bg-primary/20",
                    isToday && canClaim && "bg-primary/30 cursor-pointer hover:scale-105"
                  )}
                  onClick={isToday && canClaim ? handleClaim : undefined}
                >
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {t.day || "Day"} {index + 1}
                  </span>
                  <span className="text-lg">{reward.reward.icon}</span>
                  {isPast && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-xl">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  {isFuture && (
                    <Lock className="absolute bottom-1 end-1 w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Today's Reward */}
          <div
            className={cn(
              "bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-4 mb-4",
              canClaim && "animate-pulse"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{rewards[currentDay - 1]?.reward.icon}</span>
                <div>
                  <div className="font-bold">{rewards[currentDay - 1]?.reward.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.day || "Day"} {currentDay} {t.reward || "Reward"}
                  </div>
                </div>
              </div>
              {canClaim && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className={cn(
                    "px-4 py-2 zen-gradient text-white rounded-xl font-medium transition-all",
                    claiming ? "opacity-50" : "hover:scale-105 active:scale-95"
                  )}
                >
                  {claiming ? "..." : t.claim || "Claim!"}
                </button>
              )}
              {!canClaim && (
                <div className="text-sm text-muted-foreground">✅ {t.claimed || "Claimed"}</div>
              )}
            </div>
          </div>

          {/* Watch ad to earn bonus treats (only after claiming) */}
          {!canClaim && <RewardedAdPrompt context="daily_rewards" compact className="mb-4" />}

          {/* Streak Bonus */}
          {bonusXp > 0 && (
            <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 rounded-xl">
              <Zap className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-700">
                +{bonusXp} XP {t.streakBonus || "Streak Bonus"}! 🔥
              </span>
            </div>
          )}

          {/* Tip */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t.dailyRewardsTip || "Come back every day for better rewards!"}
          </p>
        </div>
      </div>
    </div>
  );
}
