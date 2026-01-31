/**
 * WeeklyInsightsCard - Weekly summary with AI-powered recommendations
 * Part of v1.5.0 Intelligence & Speed
 */

import { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Sparkles,
  Target,
  Brain,
  Heart,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import {
  generateWeeklyInsights,
  hasEnoughDataForWeeklyInsights,
  WeeklyInsightsData,
  Recommendation,
} from '@/lib/weeklyInsights';
import { hapticTap } from '@/lib/haptics';

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
// RECOMMENDATION CARD
// ============================================

function RecommendationCard({
  recommendation,
  t,
  onAction,
}: {
  recommendation: Recommendation;
  t: Record<string, string>;
  onAction?: (actionId: string) => void;
}) {
  const priorityColors = {
    high: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
    medium: 'border-[hsl(var(--mood-okay))]/30 bg-[hsl(var(--mood-okay))]/5 hover:bg-[hsl(var(--mood-okay))]/10',
    low: 'border-[hsl(var(--mood-good))]/30 bg-[hsl(var(--mood-good))]/5 hover:bg-[hsl(var(--mood-good))]/10',
  };

  const typeIcons = {
    habit: <Target className="w-4 h-4" />,
    mood: <Heart className="w-4 h-4" />,
    focus: <Brain className="w-4 h-4" />,
    general: <Lightbulb className="w-4 h-4" />,
  };

  const handleClick = () => {
    if (onAction) {
      hapticTap();
      onAction(recommendation.id);
    }
  };

  const title = t[recommendation.titleKey] || recommendation.title;

  return (
    <button
      onClick={handleClick}
      aria-label={title}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all',
        'active:scale-[0.98]',
        priorityColors[recommendation.priority],
        onAction && 'cursor-pointer'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0" aria-hidden="true">{recommendation.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground" aria-hidden="true">
              {typeIcons[recommendation.type]}
            </span>
            <p className="font-medium text-sm text-foreground truncate">
              {title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {t[recommendation.descriptionKey] || recommendation.description}
          </p>
          {recommendation.action && (
            <p className="text-xs font-medium text-primary mt-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              {t[recommendation.actionKey] || recommendation.action}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================
// COMPARISON BADGE
// ============================================

function ComparisonBadge({
  value,
  label,
  suffix = '%',
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div className="text-center">
      <div
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
          isPositive && 'bg-[hsl(var(--mood-good))]/10 text-[hsl(var(--mood-good))]',
          value < 0 && 'bg-destructive/10 text-destructive',
          isNeutral && 'bg-muted text-muted-foreground'
        )}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : value < 0 ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        <span>
          {isPositive && '+'}
          {value}{suffix}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
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
    <div className={cn('bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">
              {t.weeklyInsights || 'Weekly Insights'}
            </h3>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
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
              <span
                key={i}
                className="text-xs bg-background/50 px-2 py-1 rounded-lg text-foreground"
              >
                {highlight}
              </span>
            ))}
          </div>
        )}
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
              <Lightbulb className="w-4 h-4 text-amber-500" />
              {t.recommendations || 'Recommendations'}
            </p>
            {recommendations.length > 2 && (
              <button
                onClick={() => {
                  hapticTap();
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

          <div className="space-y-2">
            {displayedRecommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                t={t}
                onAction={onRecommendationAction}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-2 p-3 bg-muted/50 rounded-xl">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {currentWeek.moodAverage > 0 ? currentWeek.moodAverage : '-'}
            </p>
            <p className="text-xs text-muted-foreground">{t.avgMood || 'Avg Mood'}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {currentWeek.habitCompletionRate}%
            </p>
            <p className="text-xs text-muted-foreground">{t.habits || 'Habits'}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {currentWeek.focusMinutes}m
            </p>
            <p className="text-xs text-muted-foreground">{t.focus || 'Focus'}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {currentWeek.streakDays}
            </p>
            <p className="text-xs text-muted-foreground">{t.streak || 'Streak'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeeklyInsightsCard;
