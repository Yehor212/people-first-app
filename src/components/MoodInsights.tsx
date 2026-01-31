/**
 * MoodInsights - AI-powered mood pattern analysis
 * Displays personalized insights based on mood, habits, and focus data
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, X, Brain, TrendingUp, Heart, Target } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { generateMoodInsights, MoodInsight } from '@/lib/moodInsights';

interface MoodInsightsProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
}

// Helper function to get icon for insight type - avoids module-level const with component refs
function getInsightIcon(type: MoodInsight['type']) {
  switch (type) {
    case 'pattern': return TrendingUp;
    case 'correlation': return Brain;
    case 'tip': return Target;
    case 'achievement': return Sparkles;
    case 'warning': return Heart;
    default: return Brain;
  }
}

// Helper function to get color for insight type using CSS variables
function getInsightColor(type: MoodInsight['type']) {
  switch (type) {
    case 'pattern': return 'from-[hsl(var(--insight-mood))]/20 to-[hsl(var(--insight-mood))]/10 border-[hsl(var(--insight-mood))]/30';
    case 'correlation': return 'from-[hsl(var(--insight-habit))]/20 to-[hsl(var(--insight-habit))]/10 border-[hsl(var(--insight-habit))]/30';
    case 'tip': return 'from-[hsl(var(--insight-energy))]/20 to-[hsl(var(--insight-energy))]/10 border-[hsl(var(--insight-energy))]/30';
    case 'achievement': return 'from-[hsl(var(--insight-positive))]/20 to-[hsl(var(--insight-positive))]/10 border-[hsl(var(--insight-positive))]/30';
    case 'warning': return 'from-[hsl(var(--insight-warning))]/20 to-[hsl(var(--insight-warning))]/10 border-[hsl(var(--insight-warning))]/30';
    default: return 'from-[hsl(var(--insight-mood))]/20 to-[hsl(var(--insight-mood))]/10 border-[hsl(var(--insight-mood))]/30';
  }
}

// Helper function to interpolate translation parameters
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? key));
}

// Helper function to get translated insight text with fallback
function getInsightText(
  insight: MoodInsight,
  t: Record<string, unknown>,
  field: 'title' | 'description'
): string {
  const key = field === 'title' ? insight.titleKey : insight.descriptionKey;
  const fallback = field === 'title' ? insight.title : insight.description;

  // If no key or translation not found, use fallback
  const translation = key ? (t as Record<string, string>)[key] : undefined;
  if (!translation) return fallback;

  // Interpolate parameters
  return insight.params ? interpolate(translation, insight.params) : translation;
}

export function MoodInsights({
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
}: MoodInsightsProps) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const insights = useMemo(() => {
    return generateMoodInsights(moods, habits, focusSessions, gratitudeEntries)
      .filter(insight => !dismissedIds.has(insight.id));
  }, [moods, habits, focusSessions, gratitudeEntries, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  if (insights.length === 0) {
    // Not enough data yet
    if (moods.length < 7) {
      return (
        <div className="bg-card rounded-2xl p-5 zen-shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{t.aiInsights || 'AI Insights'}</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🔮</div>
            <p className="text-sm text-muted-foreground">
              {t.insightsNeedMoreData || 'Log your mood for a week to unlock personalized insights!'}
            </p>
            <div className="mt-3 flex justify-center gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full",
                    i < moods.length ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {moods.length}/7 {t.daysLogged || 'days logged'}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const featuredInsight = insights[0];
  const otherInsights = insights.slice(1);
  const FeaturedIcon = getInsightIcon(featuredInsight.type);

  return (
    <div className="space-y-3">
      {/* Featured Insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative bg-gradient-to-br rounded-2xl p-5 border overflow-hidden",
          getInsightColor(featuredInsight.type)
        )}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        {/* Dismiss button */}
        <button
          onClick={() => handleDismiss(featuredInsight.id)}
          aria-label={t.insightsDismiss || 'Dismiss insight'}
          className="absolute top-3 right-3 p-1.5 hover:bg-black/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-primary/20 rounded-xl">
            <FeaturedIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs font-medium text-primary uppercase tracking-wide">
              {t.aiInsight || 'AI Insight'}
            </div>
            <h3 className="font-semibold text-foreground">{t.personalizedForYou || 'Personalized for you'}</h3>
          </div>
        </div>

        {/* Insight content */}
        <div className="flex items-start gap-4">
          <div className="text-4xl">{featuredInsight.icon}</div>
          <div className="flex-1">
            <h4 className="font-bold text-foreground mb-1">{getInsightText(featuredInsight, t as unknown as Record<string, unknown>, 'title')}</h4>
            <p className="text-sm text-muted-foreground">{getInsightText(featuredInsight, t as unknown as Record<string, unknown>, 'description')}</p>
          </div>
        </div>

        {/* Show more button */}
        {otherInsights.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            aria-label={showAll ? (t.hideInsights || 'Hide insights') : (t.moreInsights || 'Show more insights')}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <span>
              {showAll
                ? (t.hideInsights || 'Hide insights')
                : `${t.showMore || 'Show'} ${otherInsights.length} ${t.moreInsights || 'more insights'}`}
            </span>
            <ChevronRight className={cn("w-4 h-4 transition-transform", showAll && "rotate-90")} />
          </button>
        )}
      </motion.div>

      {/* Other Insights */}
      <AnimatePresence>
        {showAll && otherInsights.map((insight, index) => {
          const Icon = getInsightIcon(insight.type);
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative bg-gradient-to-br rounded-xl p-4 border",
                getInsightColor(insight.type)
              )}
            >
              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(insight.id)}
                aria-label={t.insightsDismiss || 'Dismiss insight'}
                className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-lg transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1 pr-6">
                  <h4 className="font-semibold text-foreground text-sm mb-0.5">{getInsightText(insight, t as unknown as Record<string, unknown>, 'title')}</h4>
                  <p className="text-xs text-muted-foreground">{getInsightText(insight, t as unknown as Record<string, unknown>, 'description')}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
