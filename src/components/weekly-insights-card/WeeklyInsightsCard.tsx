/**
 * WeeklyInsightsCard - Weekly summary with AI-powered recommendations
 * Phase 12: Premium upgrade with particles, animations, and glassmorphism
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import {
  generateWeeklyInsights,
  hasEnoughDataForWeeklyInsights,
  WeeklyInsightsData,
} from '@/lib/weeklyInsights';
import { hapticTap } from '@/lib/haptics';
import { ParticleBackground } from '@/components/stats/ParticleBackground';
import { RecommendationCard, ComparisonBadge } from './WeeklyInsightsParts';

// ============================================
// TYPES
// ============================================

interface WeeklyInsightsCardProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  className?: string;
  onRecommendationAction?: (actionId: string) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WeeklyInsightsCard({
  moods,
  habits,
  focusSessions,
  gratitudeEntries = [],
  className,
  onRecommendationAction,
}: WeeklyInsightsCardProps) {
  const { t } = useLanguage();
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  // Check if enough data
  const hasEnoughData = useMemo(
    () => hasEnoughDataForWeeklyInsights(moods, habits, focusSessions),
    [moods, habits, focusSessions]
  );

  // Generate insights
  const insights = useMemo<WeeklyInsightsData | null>(() => {
    if (!hasEnoughData) return null;
    return generateWeeklyInsights(moods, habits, focusSessions, gratitudeEntries);
  }, [moods, habits, focusSessions, gratitudeEntries, hasEnoughData]);

  // Not enough data state
  if (!hasEnoughData || !insights) {
    return (
      <div className={cn('bg-card rounded-2xl p-6 zen-shadow-card border border-border', className)}>
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {t.weeklyInsights || 'Weekly Insights'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.weeklyInsightsNotEnoughData || 'Track your progress this week to unlock personalized insights and recommendations.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { currentWeek, comparison, recommendations, highlights } = insights;

  const trendIcon = {
    improving: <TrendingUp className="w-4 h-4 text-[hsl(var(--mood-good))]" />,
    declining: <TrendingDown className="w-4 h-4 text-destructive" />,
    stable: <Minus className="w-4 h-4 text-muted-foreground" />,
  };

  const displayedRecommendations = showAllRecommendations
    ? recommendations
    : recommendations.slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('bg-card/80 backdrop-blur-sm rounded-2xl zen-shadow-card border border-border/50 overflow-hidden', className)}
    >
      {/* Premium Header with Particles */}
      <div className="relative overflow-hidden p-4 border-b border-border/50">
        {/* Animated gradient background */}
        <motion.div
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5"
          style={{ backgroundSize: '200% 200%' }}
        />

        {/* Floating particles */}
        <ParticleBackground count={6} color="primary" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                {t.weeklyInsights || 'Weekly Insights'}
              </h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium shadow-[0_0_8px_hsl(var(--primary)/0.3)]">
                {t.week || 'Week'} {insights.weekNumber}
              </span>
            </div>
            {comparison && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {trendIcon[comparison.trend]}
                <span className="capitalize">{comparison.trend}</span>
              </div>
            )}
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {highlights.map((highlight, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-xs bg-background/60 backdrop-blur-sm px-2 py-1 rounded-lg text-foreground border border-border/30"
                >
                  {highlight}
                </motion.span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Week Comparison */}
      {comparison && (
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-3">
            {t.comparedToLastWeek || 'Compared to last week'}
          </p>
          <div className="grid grid-cols-3 gap-4">
            <ComparisonBadge
              value={comparison.moodChange}
              label={t.mood || 'Mood'}
            />
            <ComparisonBadge
              value={comparison.habitsChange}
              label={t.habits || 'Habits'}
              suffix=" pts"
            />
            <ComparisonBadge
              value={comparison.focusChange}
              label={t.focus || 'Focus'}
            />
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5 text-accent" />
              </div>
              {t.recommendations || 'Recommendations'}
            </p>
            {recommendations.length > 2 && (
              <button
                onClick={() => {
                  void hapticTap();
                  setShowAllRecommendations(!showAllRecommendations);
                }}
                aria-expanded={showAllRecommendations}
                aria-label={showAllRecommendations ? (t.showLess || 'Show less') : (t.showMoreRecommendations || 'Show more recommendations')}
                className="text-xs text-primary hover:underline"
              >
                {showAllRecommendations
                  ? t.showLess || 'Show less'
                  : `${t.showMore || 'Show'} ${recommendations.length - 2} ${t.more || 'more'}`}
              </button>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {displayedRecommendations.map((rec, index) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  t={t as unknown as Record<string, string>}
                  onAction={onRecommendationAction}
                  index={index}
                />
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Premium Quick Stats Footer */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 backdrop-blur-sm rounded-xl border border-border/30">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <p className="text-lg font-bold text-primary">
              {currentWeek.moodAverage > 0 ? currentWeek.moodAverage : '-'}
            </p>
            <p className="text-xs text-muted-foreground">{t.avgMood || 'Avg Mood'}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <p className="text-lg font-bold text-[hsl(var(--chart-habit))]">
              {currentWeek.habitCompletionRate}%
            </p>
            <p className="text-xs text-muted-foreground">{t.habits || 'Habits'}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-lg font-bold text-[hsl(var(--chart-focus))]">
              {currentWeek.focusMinutes}m
            </p>
            <p className="text-xs text-muted-foreground">{t.focus || 'Focus'}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <p className="text-lg font-bold text-accent">
              {currentWeek.streakDays}
            </p>
            <p className="text-xs text-muted-foreground">{t.streak || 'Streak'}</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default WeeklyInsightsCard;
