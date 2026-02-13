/**
 * CreatureDetailModal - Full-screen overlay modal showing detailed info about a garden creature.
 * Displays creature emoji, type, stage, happiness bar, arrival date, and feed action.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useBackHandler } from '@/hooks/useBackHandler';
import { hapticTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GardenCreature } from '@/types';

interface CreatureDetailModalProps {
  creature: GardenCreature;
  treatsBalance: number;
  feedCost?: number;
  onFeed: () => void;
  onClose: () => void;
  getCreatureEmoji: (creature: GardenCreature) => string;
}

export const CreatureDetailModal = memo(function CreatureDetailModal({
  creature,
  treatsBalance,
  feedCost = 2,
  onFeed,
  onClose,
  getCreatureEmoji,
}: CreatureDetailModalProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // State declarations BEFORE hooks (TDZ prevention)
  const canFeed = treatsBalance >= feedCost;

  useScrollLock(true);
  useBackHandler(true, onClose);

  const daysAgo = useMemo(() => {
    return Math.floor((Date.now() - creature.arrivedAt) / (1000 * 60 * 60 * 24));
  }, [creature.arrivedAt]);

  const happinessPercent = Math.min(100, Math.max(0, creature.happiness));
  const stageLabel = ts[`creatureStage_${creature.stage}`] || creature.stage;
  const typeLabel = ts[`creatureType_${creature.type}`] || creature.type;

  const handleFeed = () => {
    if (!canFeed) return;
    hapticTap().catch(() => {});
    onFeed();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-md mx-auto rounded-3xl bg-card border border-border/50 shadow-xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={ts.close || 'Close'}
          className="absolute top-3 end-3 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="p-6 text-center">
          {/* Creature emoji */}
          <span className="text-7xl block mb-4 motion-safe:animate-bounce" aria-hidden="true">
            {getCreatureEmoji(creature)}
          </span>

          {/* Type name + special badge */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground capitalize">{typeLabel}</h2>
            {creature.isSpecial && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30">
                {ts.gardenSpecial || 'Special'}
              </span>
            )}
          </div>

          {/* Stage name */}
          <p className="text-sm text-muted-foreground capitalize mb-4">{stageLabel}</p>

          {/* Happiness bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{ts.creatureHappiness || 'Happiness'}</span>
              <span>{happinessPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${happinessPercent}%` }}
              />
            </div>
          </div>

          {/* Arrived date */}
          <p className="text-xs text-muted-foreground mb-6">
            {ts.creatureArrivedAgo || 'Arrived'} {daysAgo} {daysAgo === 1 ? (ts.dayAgo || 'day ago') : (ts.daysAgo || 'days ago')}
          </p>

          {/* Feed action */}
          <button
            onClick={handleFeed}
            disabled={!canFeed}
            className={cn(
              'w-full py-3 rounded-2xl font-semibold text-sm transition-all',
              canFeed
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 motion-safe:active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            )}
          >
            {'\u{1F356}'} {ts.creatureFeed || 'Feed Creature'} ({feedCost} {ts.gardenTreats || 'treats'})
          </button>
        </div>
      </motion.div>
    </>
  );
});

export default CreatureDetailModal;
