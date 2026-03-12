/**
 * TodayFocusCard - Contextual CTA card for the home screen
 * Shows the user what to do next based on today's progress.
 * Uses time-of-day awareness and the currentPrimaryCTA state machine.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Target, Brain, Moon, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';
import { cn } from '@/lib/utils';

type PrimaryCTA = 'mood' | 'habits' | 'focus' | 'complete';

interface TodayFocusCardProps {
  currentPrimaryCTA: PrimaryCTA;
  onScrollToMood?: () => void;
  onNavigateToHabits?: () => void;
  onNavigateToFocus?: () => void;
  canActivateRestMode?: boolean;
  onRestMode?: () => void;
  completedTodayCount?: number;
  isRestMode?: boolean;
}

const CTA_CONFIG = {
  mood: {
    Icon: Heart,
    colorClass: 'text-purple-500',
    bgClass: 'from-purple-500/10 to-violet-500/10 dark:from-purple-500/15 dark:to-violet-500/15',
    ringClass: 'ring-purple-500/20',
  },
  habits: {
    Icon: Target,
    colorClass: 'text-emerald-500',
    bgClass: 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/15 dark:to-teal-500/15',
    ringClass: 'ring-emerald-500/20',
  },
  focus: {
    Icon: Brain,
    colorClass: 'text-amber-500',
    bgClass: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/15 dark:to-orange-500/15',
    ringClass: 'ring-amber-500/20',
  },
} as const;

export const TodayFocusCard = memo(function TodayFocusCard({
  currentPrimaryCTA,
  onScrollToMood,
  onNavigateToHabits,
  onNavigateToFocus,
  canActivateRestMode,
  onRestMode,
  completedTodayCount = 0,
  isRestMode,
}: TodayFocusCardProps) {
  const { t } = useLanguage();

  const title = useMemo(() => {
    if (currentPrimaryCTA === 'complete') return '';
    const hour = new Date().getHours();
    if (currentPrimaryCTA === 'mood') {
      if (hour < 12) return t.todayFocusMoodMorning || 'How are you feeling this morning?';
      if (hour < 18) return t.todayFocusMoodAfternoon || 'Check in with your mood';
      return t.todayFocusMoodEvening || 'How was your day?';
    }
    if (currentPrimaryCTA === 'habits') return t.todayFocusHabits || 'Time to check off your habits';
    return t.todayFocusFocus || 'Ready for a focus session?';
  }, [currentPrimaryCTA, t]);

  // Don't show when everything is complete or in rest mode
  if (currentPrimaryCTA === 'complete' || isRestMode) return null;

  const config = CTA_CONFIG[currentPrimaryCTA];

  const handleAction = () => {
    if (currentPrimaryCTA === 'mood') onScrollToMood?.();
    else if (currentPrimaryCTA === 'habits') onNavigateToHabits?.();
    else if (currentPrimaryCTA === 'focus') onNavigateToFocus?.();
  };

  const { Icon, colorClass, bgClass, ringClass } = config;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={zenMotion.gentle}
    >
      <button
        onClick={handleAction}
        aria-label={title}
        className={cn(
          'w-full text-start p-4 rounded-2xl',
          'bg-gradient-to-r ring-1 transition-all',
          'backdrop-blur-[var(--surface-glass-blur)]',
          bgClass,
          ringClass,
          'active:scale-[0.98]',
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl bg-background/60', colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.todayFocusSubtitle || 'Your next step'}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 rtl:scale-x-[-1]" />
        </div>
      </button>

      {/* Rest day option — shown when nothing done today */}
      {canActivateRestMode && completedTodayCount === 0 && onRestMode && (
        <button
          onClick={onRestMode}
          className="mt-2 w-full py-2 min-h-[44px] flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-xl transition-colors text-xs font-medium"
        >
          <Moon className="w-3.5 h-3.5" />
          {t.restDayButton || 'Take a rest day'}
        </button>
      )}
    </motion.div>
  );
});
