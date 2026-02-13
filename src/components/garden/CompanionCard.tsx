/**
 * CompanionCard - Interactive card showing the active companion at the bottom of the garden.
 * Displays companion emoji, name, mood, level, fullness bar, and pet/feed actions.
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { Companion, CompanionMood } from '@/types';

const MOOD_EMOJIS: Record<CompanionMood, string> = {
  sleeping: '\u{1F634}',
  calm: '\u{1F60A}',
  happy: '\u{1F604}',
  excited: '\u{1F929}',
  celebrating: '\u{1F389}',
  supportive: '\u{1F917}',
};

interface CompanionCardProps {
  companion: Companion;
  treatsBalance: number;
  feedCost: number;
  onPet: () => void;
  onFeed: () => void;
  getCompanionEmoji: () => string;
  isRestMode: boolean;
}

export const CompanionCard = memo(function CompanionCard({
  companion,
  treatsBalance,
  feedCost,
  onPet,
  onFeed,
  getCompanionEmoji,
  isRestMode,
}: CompanionCardProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const moodText = ts[`companionMood_${companion.mood}`] || companion.mood;
  const fullnessPercent = Math.min(100, Math.max(0, companion.fullness));
  const canFeed = treatsBalance >= feedCost;

  const handlePet = () => {
    hapticTap().catch(() => {});
    onPet();
  };

  const handleFeed = () => {
    if (!canFeed) return;
    hapticSuccess().catch(() => {});
    onFeed();
  };

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50',
        'bg-card/90 backdrop-blur-sm shadow-sm',
        'pb-[env(safe-area-inset-bottom)]',
        isRestMode && 'opacity-60'
      )}
    >
      {/* Companion emoji */}
      <span className="text-3xl select-none" aria-hidden="true">
        {getCompanionEmoji()}
      </span>

      {/* Info section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">{companion.name}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
            {ts.companionLevel || 'Lv'} {companion.level}
          </span>
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          <span aria-hidden="true">{MOOD_EMOJIS[companion.mood]}</span>
          <span className="text-xs text-muted-foreground">{moodText}</span>
        </div>

        {/* Fullness bar */}
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{ts.fullness || 'Fullness'}</span>
            <span>{fullnessPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${fullnessPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={handlePet}
          aria-label={ts.companionPet || 'Pet companion'}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent/50 hover:bg-accent border border-border/50 motion-safe:active:scale-95 transition-all"
        >
          {ts.companionPetAction || 'Pet'}
        </button>
        <button
          onClick={handleFeed}
          disabled={!canFeed}
          aria-label={`${ts.companionFeed || 'Feed companion'} (${feedCost} ${ts.gardenTreats || 'treats'})`}
          className={cn(
            'px-3 py-1.5 rounded-xl text-xs font-medium border border-border/50 transition-all',
            canFeed
              ? 'bg-primary/15 hover:bg-primary/25 text-primary motion-safe:active:scale-95'
              : 'opacity-40 cursor-not-allowed bg-muted/30'
          )}
        >
          {ts.companionFeedAction || 'Feed'} {feedCost}
        </button>
      </div>

      {/* Rest mode zzz overlay */}
      <AnimatePresence>
        {isRestMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/40 backdrop-blur-[2px]"
            aria-hidden="true"
          >
            <Moon className="w-8 h-8 text-muted-foreground motion-safe:animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CompanionCard;
