/**
 * SeasonalEventBanner - Displays active seasonal events
 * Stage 5.3 of Premium Upgrade Plan
 *
 * Shows:
 * - Active event banner with progress
 * - Challenge completion status
 * - Rewards preview
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Gift, Trophy, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getActiveEvents,
  getEventWithProgress,
  type SeasonalEvent,
  type UserSeasonalProgress,
} from '@/lib/seasonalEvents';

interface SeasonalEventBannerProps {
  onOpenDetails?: (event: SeasonalEvent & { userProgress: UserSeasonalProgress | null }) => void;
  className?: string;
  compact?: boolean;
}

export function SeasonalEventBanner({
  onOpenDetails,
  className,
  compact = false,
}: SeasonalEventBannerProps) {
  const { t } = useLanguage();
  const [activeEvents, setActiveEvents] = useState<(SeasonalEvent & { userProgress: UserSeasonalProgress | null })[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const events = getActiveEvents();
    const eventsWithProgress = events.map(getEventWithProgress);
    setActiveEvents(eventsWithProgress);

    // Load dismissed events from sessionStorage
    try {
      const dismissedStr = sessionStorage.getItem('zenflow_dismissed_events');
      if (dismissedStr) {
        setDismissed(new Set(JSON.parse(dismissedStr)));
      }
    } catch {
      // Ignore
    }
  }, []);

  const visibleEvents = activeEvents.filter(e => !dismissed.has(e.id));

  if (visibleEvents.length === 0) {
    return null;
  }

  const currentEvent = visibleEvents[currentIndex % visibleEvents.length];

  const handleDismiss = (eventId: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(eventId);
    setDismissed(newDismissed);
    sessionStorage.setItem('zenflow_dismissed_events', JSON.stringify([...newDismissed]));
  };

  const completedChallenges = currentEvent.challenges.filter(c => c.completed).length;
  const totalChallenges = currentEvent.challenges.length;
  const progressPercent = totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0;

  // Calculate days remaining
  const endDate = new Date(currentEvent.endDate);
  const today = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "relative overflow-hidden rounded-2xl p-3",
          className
        )}
        style={{
          background: currentEvent.bannerStyle || `linear-gradient(135deg, ${currentEvent.themeColor}40 0%, ${currentEvent.themeColor}20 100%)`,
        }}
      >
        <button
          onClick={() => onOpenDetails?.(currentEvent)}
          className="flex items-center gap-3 w-full text-left"
        >
          <span className="text-2xl">{currentEvent.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {currentEvent.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {completedChallenges}/{totalChallenges} {t.challengesCompleted || 'completed'} · {daysRemaining} {t.daysLeft || 'days left'}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>

        {/* Mini progress bar */}
        <div className="mt-2 h-1 bg-background/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: currentEvent.themeColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentEvent.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "relative overflow-hidden rounded-3xl",
          className
        )}
        style={{
          background: currentEvent.bannerStyle || `linear-gradient(135deg, ${currentEvent.themeColor}40 0%, ${currentEvent.themeColor}20 100%)`,
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={() => handleDismiss(currentEvent.id)}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-background/20 hover:bg-background/40 transition-colors z-10"
          aria-label={t.dismiss || 'Dismiss'}
        >
          <X className="w-4 h-4 text-foreground/70" />
        </button>

        {/* Sparkle decorations */}
        <div className="absolute top-4 left-8 opacity-30">
          <Sparkles className="w-6 h-6 text-foreground" />
        </div>
        <div className="absolute bottom-8 right-12 opacity-20">
          <Sparkles className="w-8 h-8 text-foreground" />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: `${currentEvent.themeColor}30` }}
            >
              {currentEvent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-background/30 text-foreground">
                  {t.limitedTime || 'Limited Time'}
                </span>
                {daysRemaining <= 3 && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-destructive/20 text-destructive">
                    {daysRemaining} {t.daysLeft || 'days left'}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-lg text-foreground">
                {currentEvent.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {currentEvent.description}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {t.progress || 'Progress'}
              </span>
              <span className="text-sm text-muted-foreground">
                {completedChallenges}/{totalChallenges} {t.challenges || 'challenges'}
              </span>
            </div>
            <div className="h-2 bg-background/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: currentEvent.themeColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </div>
          </div>

          {/* Challenges preview */}
          <div className="space-y-2 mb-4">
            {currentEvent.challenges.slice(0, 2).map((challenge) => (
              <div
                key={challenge.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-xl",
                  challenge.completed
                    ? "bg-primary/10"
                    : "bg-background/20"
                )}
              >
                <span className="text-lg">{challenge.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    challenge.completed && "line-through opacity-60"
                  )}>
                    {challenge.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {challenge.progress}/{challenge.target}
                  </p>
                </div>
                {challenge.completed && (
                  <Trophy className="w-4 h-4 text-primary shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Completion reward preview */}
          {currentEvent.completionReward && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-background/20 border border-dashed border-foreground/20 mb-4">
              <Gift className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t.completeAllFor || 'Complete all for'}:
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  {currentEvent.completionReward.icon} {currentEvent.completionReward.name}
                </p>
              </div>
            </div>
          )}

          {/* CTA */}
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={() => onOpenDetails?.(currentEvent)}
          >
            {t.viewDetails || 'View Details'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Event count indicator (if multiple events) */}
        {visibleEvents.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-4">
            {visibleEvents.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex % visibleEvents.length
                    ? "w-6 bg-foreground"
                    : "bg-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default SeasonalEventBanner;
