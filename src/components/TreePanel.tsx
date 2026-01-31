/**
 * TreePanel - Seasonal Tree interaction panel
 * 2 actions: Touch (free) and Water (costs treats)
 * Shows: Tree stage, XP progress, Water level, Season
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Droplets, Hand, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { TreeStage } from '@/types';
import { SeasonalTree } from './SeasonalTree';
import { Switch } from '@/components/ui/switch';
import {
  getCurrentSeason,
  getSeasonEmoji,
  getSeasonName,
  getTreeStageName,
  getXPProgressToNextStage,
  TREE_STAGE_XP,
  Season,
} from '@/lib/seasonHelper';

interface TreePanelProps {
  treeStage: TreeStage;
  waterLevel: number;
  treeXP: number;
  treeName: string;
  isOpen: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onTouch: () => { xpGain: number; canTouchAgain: boolean; stageUp?: boolean; newStage?: TreeStage; newTreeXP?: number };
  onWater: () => { success: boolean; reason?: string; needed?: number; have?: number; waterGain: number; xpGain: number; treatCost?: number; newBalance?: number; stageUp?: boolean; newStage?: TreeStage };
  treatsBalance: number;
  waterCost: number;
  streak: number;
  calmMode: boolean;
  onCalmModeChange: (value: boolean) => void;
}

// Get contextual message based on tree state
function getContextualMessage(
  waterLevel: number,
  treeStage: TreeStage,
  treatsBalance: number,
  waterCost: number,
  streak: number,
  season: Season,
  language: string,
  t: Record<string, string>
): string {
  // Priority 1: Thirsty tree
  if (waterLevel < 30) {
    if (treatsBalance >= waterCost) {
      return t.treeThirstyCanWater || '💧 The tree needs water...';
    }
    return t.treeThirstyNoTreats || '🥀 Thirsty... Do activities to earn treats!';
  }

  // Priority 2: Celebrating streak
  if (streak >= 7) {
    return (t.treeStreakLegend || '🌟 {streak} days! The tree is glowing!').replace('{streak}', String(streak));
  }
  if (streak >= 3) {
    return (t.treeStreakGood || '✨ {streak} days! Growing strong!').replace('{streak}', String(streak));
  }

  // Priority 3: Stage specific messages
  if (treeStage === 5) {
    return t.treeMaxStage || '🌳 A magnificent great tree!';
  }
  if (treeStage === 4) {
    return t.treeStage4 || '🌲 A beautiful mature tree!';
  }
  if (treeStage === 3) {
    return t.treeStage3 || '🌿 Growing into a strong sapling!';
  }
  if (treeStage === 2) {
    return t.treeStage2 || '🌱 A young sprout reaching for light!';
  }
  if (treeStage === 1) {
    return t.treeStage1 || '🌰 A tiny seed full of potential!';
  }

  // Priority 4: Well watered
  if (waterLevel >= 70) {
    return t.treeHappy || '💚 The tree is flourishing!';
  }

  // Priority 5: Season-based
  const seasonName = getSeasonName(season, language);
  return (t.treeSeason || '{emoji} Beautiful {season}!').replace('{emoji}', getSeasonEmoji(season)).replace('{season}', seasonName);
}

export function TreePanel({
  treeStage,
  waterLevel,
  treeXP,
  treeName,
  isOpen,
  onClose,
  onRename,
  onTouch,
  onWater,
  treatsBalance,
  waterCost,
  streak,
  calmMode,
  onCalmModeChange,
}: TreePanelProps) {
  const { t, language } = useLanguage();
  const [message, setMessage] = useState('');
  const [showReaction, setShowReaction] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWatering, setIsWatering] = useState(false);

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

  const season = getCurrentSeason();
  const stageName = getTreeStageName(treeStage, language);
  const xpProgress = getXPProgressToNextStage(treeXP, treeStage);
  const nextStageXP = treeStage < 5 ? TREE_STAGE_XP[(treeStage + 1) as TreeStage] : TREE_STAGE_XP[5];
  const currentStageXP = TREE_STAGE_XP[treeStage];
  const xpInStage = treeXP - currentStageXP;
  const xpNeededForNext = nextStageXP - currentStageXP;

  // Update message on open
  useEffect(() => {
    if (isOpen) {
      setMessage(getContextualMessage(
        waterLevel, treeStage, treatsBalance, waterCost, streak, season, language, t as Record<string, string>
      ));
    }
  }, [isOpen, waterLevel, treeStage, treatsBalance, waterCost, streak, season, language, t]);

  const handleTouch = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onTouch();
    const reactions = [
      t.touchReaction1 || '✨ *rustles leaves*',
      t.touchReaction2 || '🍃 The leaves dance!',
      t.touchReaction3 || '💚 Feels alive!',
      t.touchReaction4 || '🌿 Growing stronger!',
    ];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    setShowReaction(reaction + ` +${result.xpGain} XP`);

    // P1 Fix: Store timeout ref and check mounted before updating state
    // Capture current values to avoid stale closure
    const capturedWaterLevel = waterLevel;
    const capturedTreeStage = treeStage;
    const capturedTreatsBalance = treatsBalance;
    const capturedWaterCost = waterCost;
    const capturedStreak = streak;

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setShowReaction(null);
      setIsAnimating(false);
      if (result.stageUp) {
        const newStageName = getTreeStageName(result.newStage!, language);
        setMessage((t.treeStageUp || '🎉 Evolved to {stage}!').replace('{stage}', newStageName));
      } else {
        setMessage(getContextualMessage(
          capturedWaterLevel, capturedTreeStage, capturedTreatsBalance, capturedWaterCost, capturedStreak, season, language, t as Record<string, string>
        ));
      }
    }, 1500);
  };

  const handleWater = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsWatering(true);
    const result = onWater();

    if (!result.success) {
      const notEnough = (t.waterNotEnough || '🍪 Need {needed} treats, have {have}')
        .replace('{needed}', String(result.needed))
        .replace('{have}', String(result.have));
      setShowReaction(notEnough);
      setIsWatering(false);
    } else {
      const reactions = [
        t.waterReaction1 || '💧 *absorbs water*',
        t.waterReaction2 || '🌊 Refreshing!',
        t.waterReaction3 || '💦 Thank you!',
        t.waterReaction4 || '✨ Growing!',
      ];
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      setShowReaction(reaction + ` +${result.xpGain} XP`);
    }

    // P1 Fix: Store timeout ref and check mounted before updating state
    // Capture current values to avoid stale closure
    const capturedWaterLevel = waterLevel;
    const capturedTreeStage = treeStage;
    const capturedTreatsBalance = treatsBalance;
    const capturedWaterCost = waterCost;
    const capturedStreak = streak;

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setShowReaction(null);
      setIsAnimating(false);
      setIsWatering(false);
      if (result.stageUp) {
        const newStageName = getTreeStageName(result.newStage!, language);
        setMessage((t.treeStageUp || '🎉 Evolved to {stage}!').replace('{stage}', newStageName));
      } else {
        setMessage(getContextualMessage(
          result.success ? capturedWaterLevel + result.waterGain : capturedWaterLevel,
          capturedTreeStage,
          result.success ? (result.newBalance || capturedTreatsBalance) : capturedTreatsBalance,
          capturedWaterCost, capturedStreak, season, language, t as Record<string, string>
        ));
      }
    }, 2000);
  };

  const canWater = treatsBalance >= waterCost;

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
          aria-labelledby="tree-panel-title"
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
              <div className="flex items-center gap-2">
                <span className="text-lg">{getSeasonEmoji(season)}</span>
                <h2 id="tree-panel-title" className="text-lg font-semibold">{t.myTree || 'My Tree'}</h2>
              </div>
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
              {/* Speech bubble */}
              <motion.div
                className="text-center mb-4"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                key={showReaction || message}
              >
                <div className={cn(
                  "inline-block px-4 py-2 rounded-2xl",
                  showReaction ? "bg-primary/20 text-primary" : "bg-muted"
                )}>
                  <p className="text-sm font-medium">{showReaction || message}</p>
                </div>
              </motion.div>

              {/* Tree display */}
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={isAnimating ? {
                    scale: [1, 1.05, 1],
                  } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <SeasonalTree
                    stage={treeStage}
                    waterLevel={waterLevel}
                    xp={treeXP}
                    season={season}
                    isWatering={isWatering}
                    lowStimulus={calmMode}
                    size="lg"
                    className="drop-shadow-xl"
                  />
                </motion.div>
              </div>

              {/* Stage name */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{stageName}</span>
                  <span className="text-xs text-muted-foreground">
                    ({t.stage || 'Stage'} {treeStage}/5)
                  </span>
                </div>
              </div>

              {/* Two action buttons: Touch (free) and Water (costs treats) */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Touch - FREE */}
                <button
                  onClick={handleTouch}
                  disabled={isAnimating}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl transition-all",
                    "bg-[hsl(var(--mood-good))]/10 dark:bg-[hsl(var(--mood-good))]/15",
                    "hover:bg-[hsl(var(--mood-good))]/20 dark:hover:bg-[hsl(var(--mood-good))]/25 hover:scale-105",
                    "active:scale-95",
                    isAnimating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Hand className="w-8 h-8 text-[hsl(var(--mood-good))]" />
                  <span className="text-sm font-medium">{t.touch || 'Touch'}</span>
                  <span className="text-xs text-muted-foreground">{t.free || 'Free'}</span>
                </button>

                {/* Water - COSTS TREATS */}
                <button
                  onClick={handleWater}
                  disabled={isAnimating || !canWater}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-2xl transition-all",
                    "bg-accent/10 dark:bg-accent/15",
                    "hover:bg-accent/20 dark:hover:bg-accent/25 hover:scale-105",
                    "active:scale-95",
                    waterLevel < 30 && canWater && "ring-2 ring-accent animate-pulse",
                    (isAnimating || !canWater) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Droplets className="w-8 h-8 text-accent" />
                  <span className="text-sm font-medium">{t.water || 'Water'}</span>
                  <span className="text-xs text-accent font-medium">🍪 {waterCost}</span>
                </button>
              </div>

              {/* XP Progress to next stage */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{t.growth || 'Growth'}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {treeStage < 5 ? `${xpInStage}/${xpNeededForNext} XP` : `${treeXP} XP ✓`}
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-primary/80"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                {treeStage < 5 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {(t.xpToNextStage || '{xp} XP to {stage}').replace('{xp}', String(xpNeededForNext - xpInStage)).replace('{stage}', getTreeStageName((treeStage + 1) as TreeStage, language))}
                  </p>
                )}
              </div>

              {/* Water level bar */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">💧 {t.waterLevel || 'Water Level'}</span>
                  <span className={cn(
                    "text-sm font-bold",
                    waterLevel >= 70 ? "text-accent" : waterLevel >= 30 ? "text-primary" : "text-[hsl(var(--mood-okay))]"
                  )}>
                    {waterLevel}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full transition-all",
                      waterLevel >= 70 ? "bg-gradient-to-r from-accent to-accent/80" :
                      waterLevel >= 30 ? "bg-gradient-to-r from-primary to-primary/80" :
                      "bg-gradient-to-r from-[hsl(var(--mood-okay))] to-[hsl(var(--mood-okay))]/80"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${waterLevel}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                {waterLevel < 30 && (
                  <p className="text-xs text-[hsl(var(--mood-okay))] mt-2 text-center">
                    {t.treeNeedsWater || 'The tree needs water!'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t.waterDecayHint || 'Water level decreases -2% per hour'}
                </p>
              </div>

              {/* Streak display */}
              {streak > 0 && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl p-4 mb-6 text-center">
                  <p className="text-3xl mb-1">🔥 {streak}</p>
                  <p className="text-sm font-medium">{t.daysInRow || 'days in a row'}</p>
                </div>
              )}

              {/* Calm visuals toggle */}
              <div className="bg-muted/30 rounded-xl p-3 text-center mb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-sm font-medium">{t.dopamineMinimal}</p>
                    <p className="text-xs text-muted-foreground">{t.dopamineMinimalDesc}</p>
                  </div>
                  <Switch checked={calmMode} onCheckedChange={onCalmModeChange} />
                </div>
              </div>

              {/* Season display */}
              <div className="bg-muted/30 rounded-xl p-3 text-center mb-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">{getSeasonEmoji(season)}</span>
                  <span className="font-medium">{getSeasonName(season, language)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.seasonTreeHint || 'The tree changes with the seasons!'}
                </p>
              </div>

              {/* How to earn treats hint */}
              <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                <p>💡 {t.earnTreatsHint || 'Complete activities to earn treats for your tree!'}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
