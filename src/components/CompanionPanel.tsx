/**
 * CompanionPanel - Simplified companion panel with treats system
 * 2 actions: Pet (free) and Feed (costs treats)
 * Shows: Level, XP, Fullness, Treats balance
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Check, Star, Hand, Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Companion, CompanionType } from '@/types';
import { COMPANION_EMOJIS } from '@/lib/innerWorldConstants';
import { COMPANION_LEVELING } from '@/lib/treatConstants';

interface CompanionPanelProps {
  companion: Companion;
  isOpen: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onChangeType: (type: CompanionType) => void;
  onPet: () => { xpGain: number; canPetAgain: boolean; leveledUp?: boolean; newLevel?: number };
  onFeed: () => { success: boolean; reason?: string; needed?: number; have?: number; fullnessGain: number; xpGain: number; treatCost?: number; newBalance?: number; leveledUp?: boolean; newLevel?: number };
  treatsBalance: number;
  feedCost: number;
  streak: number;
  hasMoodToday: boolean;
  hasHabitsToday: boolean;
  hasFocusToday: boolean;
  hasGratitudeToday: boolean;
}

const COMPANION_TYPES: CompanionType[] = ['fox', 'cat', 'owl', 'rabbit', 'dragon'];

// Get contextual message based on companion state
function getContextualMessage(
  companion: Companion,
  treatsBalance: number,
  feedCost: number,
  hasMoodToday: boolean,
  hasHabitsToday: boolean,
  hasFocusToday: boolean,
  hasGratitudeToday: boolean,
  streak: number,
  t: Record<string, string>
): string {
  const hour = new Date().getHours();
  const fullness = companion.fullness ?? 50;

  // Priority 1: Hungry companion
  if (fullness < 30) {
    if (treatsBalance >= feedCost) {
      return t.companionHungryCanFeed || '🥺 I\'m hungry... Feed me?';
    }
    return t.companionHungryNoTreats || '🥺 I\'m hungry... Do activities to earn treats!';
  }

  // Priority 2: Celebrating streak
  if (streak >= 7) {
    return (t.companionStreakLegend || '🏆 {streak} days! You\'re a legend!').replace('{streak}', String(streak));
  }
  if (streak >= 3) {
    return (t.companionStreakGood || '🔥 {streak} days! Keep it up!').replace('{streak}', String(streak));
  }

  // Priority 3: Activity reminders
  if (!hasMoodToday) {
    return t.companionAskMood || '💜 How are you feeling today?';
  }
  if (!hasHabitsToday) {
    return t.companionAskHabits || '🎯 Time for habits!';
  }
  if (!hasFocusToday) {
    return t.companionAskFocus || '🧠 Ready to focus?';
  }
  if (!hasGratitudeToday) {
    return t.companionAskGratitude || '💖 What are you grateful for?';
  }

  // Priority 4: All done!
  if (hasMoodToday && hasHabitsToday && hasFocusToday && hasGratitudeToday) {
    return t.companionAllDone || '🏆 Perfect day! You\'re amazing!';
  }

  // Priority 5: Happy companion
  if (fullness >= 70) {
    return t.companionHappy || '💕 I love you!';
  }

  // Default: Time-based
  if (hour >= 5 && hour < 12) {
    return t.companionMorning || '☀️ Good morning!';
  }
  if (hour >= 12 && hour < 18) {
    return t.companionAfternoon || '🌤️ How\'s your day going?';
  }
  if (hour >= 18 && hour < 23) {
    return t.companionEvening || '🌙 Good evening!';
  }
  return t.companionNight || '💤 Zzz...';
}

export function CompanionPanel({
  companion,
  isOpen,
  onClose,
  onRename,
  onChangeType,
  onPet,
  onFeed,
  treatsBalance,
  feedCost,
  streak,
  hasMoodToday,
  hasHabitsToday,
  hasFocusToday,
  hasGratitudeToday,
}: CompanionPanelProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(companion.name);
  const [message, setMessage] = useState('');
  const [showReaction, setShowReaction] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // P1 Fix: Track mounted state and timeouts to prevent memory leaks
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update message on open
  useEffect(() => {
    if (isOpen) {
      setMessage(getContextualMessage(
        companion, treatsBalance, feedCost,
        hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday,
        streak, t as Record<string, string>
      ));
    }
  }, [isOpen, companion, treatsBalance, feedCost, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak, t]);

  const handleSaveName = () => {
    if (editName.trim()) {
      onRename(editName.trim());
      setIsEditing(false);
    }
  };

  const handleTypeChange = (type: CompanionType) => {
    onChangeType(type);
  };

  const handlePet = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onPet();
    const reactions = [
      t.petReaction1 || '💕 *purr*',
      t.petReaction2 || '✨ That feels nice!',
      t.petReaction3 || '😊 Thank you!',
      t.petReaction4 || '💖 I love you!',
    ];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    setShowReaction(reaction + ` +${result.xpGain} XP`);

    // P1 Fix: Store timeout ref and check mounted before updating state
    // Capture current values to avoid stale closure
    const capturedCompanion = companion;
    const capturedTreatsBalance = treatsBalance;
    const capturedFeedCost = feedCost;
    const capturedHasMoodToday = hasMoodToday;
    const capturedHasHabitsToday = hasHabitsToday;
    const capturedHasFocusToday = hasFocusToday;
    const capturedHasGratitudeToday = hasGratitudeToday;
    const capturedStreak = streak;

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setShowReaction(null);
      setIsAnimating(false);
      if (result.leveledUp) {
        setMessage((t.companionLevelUp || '🎉 Level up! Now level {level}!').replace('{level}', String(result.newLevel)));
      } else {
        setMessage(getContextualMessage(
          capturedCompanion, capturedTreatsBalance, capturedFeedCost,
          capturedHasMoodToday, capturedHasHabitsToday, capturedHasFocusToday, capturedHasGratitudeToday,
          capturedStreak, t as Record<string, string>
        ));
      }
    }, 1500);
  };

  const handleFeed = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onFeed();

    if (!result.success) {
      const notEnough = (t.feedNotEnough || '🍪 Need {needed} treats, have {have}')
        .replace('{needed}', String(result.needed))
        .replace('{have}', String(result.have));
      setShowReaction(notEnough);
    } else {
      const reactions = [
        t.feedReaction1 || '🍪 Yummy!',
        t.feedReaction2 || '😋 Delicious!',
        t.feedReaction3 || '✨ Thank you!',
        t.feedReaction4 || '💪 Energy!',
      ];
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      setShowReaction(reaction + ` +${result.xpGain} XP`);
    }

    // P1 Fix: Store timeout ref and check mounted before updating state
    // Capture current values to avoid stale closure
    const capturedCompanion = companion;
    const capturedTreatsBalance = treatsBalance;
    const capturedFeedCost = feedCost;
    const capturedHasMoodToday = hasMoodToday;
    const capturedHasHabitsToday = hasHabitsToday;
    const capturedHasFocusToday = hasFocusToday;
    const capturedHasGratitudeToday = hasGratitudeToday;
    const capturedStreak = streak;

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setShowReaction(null);
      setIsAnimating(false);
      if (result.leveledUp) {
        setMessage((t.companionLevelUp || '🎉 Level up! Now level {level}!').replace('{level}', String(result.newLevel)));
      } else {
        setMessage(getContextualMessage(
          { ...capturedCompanion, fullness: (capturedCompanion.fullness || 50) + (result.success ? result.fullnessGain : 0) },
          result.success ? (result.newBalance || capturedTreatsBalance) : capturedTreatsBalance,
          capturedFeedCost,
          capturedHasMoodToday, capturedHasHabitsToday, capturedHasFocusToday, capturedHasGratitudeToday,
          capturedStreak, t as Record<string, string>
        ));
      }
    }, 1500);
  };

  // Calculate XP progress
  const xpForNextLevel = COMPANION_LEVELING.xpPerLevel(companion.level);
  const xpProgress = (companion.experience / xpForNextLevel) * 100;

  // Get fullness (main stat now)
  const fullness = companion.fullness ?? 50;
  const canFeed = treatsBalance >= feedCost;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          style={{ zIndex: 'var(--z-overlay)', marginBottom: 'var(--nav-height)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="companion-panel-title"
        >
          <motion.div
            className="w-full max-w-lg bg-gradient-to-b from-primary/10 to-background rounded-t-3xl max-h-[85vh] overflow-hidden"
            style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 id="companion-panel-title" className="text-lg font-semibold">{t.myCompanion}</h2>
              {/* Treats Balance */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 rounded-full" aria-label={`${t.treats || 'Treats'}: ${treatsBalance}`}>
                  <span className="text-lg">🍪</span>
                  <span className="font-bold text-accent">{treatsBalance}</span>
                </div>
                <button
                  onClick={onClose}
                  aria-label={t.close || 'Close'}
                  className="p-2 min-w-[44px] min-h-[44px] rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Companion display */}
              <div className="text-center mb-6">
                {/* Speech bubble */}
                <motion.div
                  className="inline-block relative mb-4"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  key={showReaction || message}
                >
                  <div className={cn(
                    "px-4 py-2 rounded-2xl relative",
                    showReaction ? "bg-primary/20 text-primary" : "bg-muted"
                  )}>
                    <p className="text-sm font-medium">{showReaction || message}</p>
                    <div className={cn(
                      "absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45",
                      showReaction ? "bg-primary/20" : "bg-muted"
                    )} />
                  </div>
                </motion.div>

                {/* Big companion emoji */}
                <motion.div
                  className="text-8xl mb-4"
                  animate={isAnimating ? {
                    scale: [1, 1.2, 1],
                    rotate: [-5, 5, -5, 0],
                  } : {
                    y: [0, -10, 0],
                    rotate: [-2, 2, -2],
                  }}
                  transition={{
                    duration: isAnimating ? 0.5 : 2,
                    repeat: isAnimating ? 0 : Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {COMPANION_EMOJIS[companion.type]}
                </motion.div>

                {/* Name with edit */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1 rounded-lg bg-muted border border-border text-center font-medium"
                        maxLength={20}
                        autoFocus
                        aria-label={t.companionName || 'Companion name'}
                      />
                      <button
                        onClick={handleSaveName}
                        aria-label={t.save || 'Save'}
                        className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold">{companion.name}</h3>
                      <button
                        onClick={() => {
                          setEditName(companion.name);
                          setIsEditing(true);
                        }}
                        aria-label={t.editName || 'Edit name'}
                        className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
                      >
                        <Edit3 className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Two action buttons: Pet (free) and Feed (costs treats) */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Pet - FREE */}
                <button
                  onClick={handlePet}
                  disabled={isAnimating}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl transition-all",
                    "bg-gradient-to-br from-pink-500/20 to-red-500/20",
                    "hover:from-pink-500/30 hover:to-red-500/30 hover:scale-105",
                    "active:scale-95",
                    isAnimating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Hand className="w-8 h-8 text-pink-500" />
                  <span className="text-sm font-medium">{t.pet || 'Pet'}</span>
                  <span className="text-xs text-muted-foreground">{t.free || 'Free'}</span>
                </button>

                {/* Feed - COSTS TREATS */}
                <button
                  onClick={handleFeed}
                  disabled={isAnimating || !canFeed}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl transition-all",
                    "bg-gradient-to-br from-orange-500/20 to-yellow-500/20",
                    "hover:from-orange-500/30 hover:to-yellow-500/30 hover:scale-105",
                    "active:scale-95",
                    fullness < 30 && canFeed && "ring-2 ring-orange-500 animate-pulse",
                    (isAnimating || !canFeed) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Cookie className="w-8 h-8 text-orange-500" />
                  <span className="text-sm font-medium">{t.feed || 'Feed'}</span>
                  <span className="text-xs text-orange-500 font-medium">🍪 {feedCost}</span>
                </button>
              </div>

              {/* Level and XP */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">{t.level || 'Level'} {companion.level}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {companion.experience}/{xpForNextLevel} XP
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Fullness bar (main stat) */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">🍽️ {t.fullness || 'Fullness'}</span>
                  <span className={cn(
                    "text-sm font-bold",
                    fullness >= 70 ? "text-[hsl(var(--mood-good))]" : fullness >= 30 ? "text-[hsl(var(--mood-okay))]" : "text-destructive"
                  )}>
                    {fullness}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full transition-all",
                      fullness >= 70 ? "bg-gradient-to-r from-[hsl(var(--mood-good))] to-[hsl(var(--mood-good))]/80" :
                      fullness >= 30 ? "bg-gradient-to-r from-[hsl(var(--mood-okay))] to-accent" :
                      "bg-gradient-to-r from-destructive to-destructive/80"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${fullness}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                {fullness < 30 && (
                  <p className="text-xs text-destructive mt-2 text-center">
                    {t.companionNeedsFood || 'Your companion is hungry!'}
                  </p>
                )}
              </div>

              {/* Streak display */}
              {streak > 0 && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl p-4 mb-6 text-center">
                  <p className="text-3xl mb-1">🔥 {streak}</p>
                  <p className="text-sm font-medium">{t.daysInRow || 'days in a row'}</p>
                </div>
              )}

              {/* Companion selector */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  {t.chooseCompanion || 'Choose companion'}
                </h4>
                <div className="flex justify-center gap-2 flex-wrap">
                  {COMPANION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      aria-label={`${t.selectCompanion || 'Select'} ${type}`}
                      aria-pressed={companion.type === type}
                      className={cn(
                        "p-3 rounded-xl text-3xl transition-all",
                        companion.type === type
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "bg-muted hover:bg-muted/80 hover:scale-105"
                      )}
                    >
                      {COMPANION_EMOJIS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* How to earn treats hint */}
              <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                <p>💡 {t.earnTreatsHint || 'Complete activities to earn treats for your companion!'}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
