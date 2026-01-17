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

const TYPE_ICONS = {
  pattern: TrendingUp,
  correlation: Brain,
  tip: Target,
  achievement: Sparkles,
  warning: Heart,
};

const TYPE_COLORS = {
  pattern: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  correlation: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  tip: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
  achievement: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  warning: 'from-red-500/20 to-rose-500/20 border-red-500/30',
};

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
  const FeaturedIcon = TYPE_ICONS[featuredInsight.type];

  return (
    <div className="space-y-3">
      {/* Featured Insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative bg-gradient-to-br rounded-2xl p-5 border overflow-hidden",
          TYPE_COLORS[featuredInsight.type]
        )}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        {/* Dismiss button */}
        <button
          onClick={() => handleDismiss(featuredInsight.id)}
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
            <h4 className="font-bold text-foreground mb-1">{featuredInsight.title}</h4>
            <p className="text-sm text-muted-foreground">{featuredInsight.description}</p>
          </div>
        </div>

        {/* Show more button */}
        {otherInsights.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
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
          const Icon = TYPE_ICONS[insight.type];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative bg-gradient-to-br rounded-xl p-4 border",
                TYPE_COLORS[insight.type]
              )}
            >
              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(insight.id)}
                className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-lg transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1 pr-6">
                  <h4 className="font-semibold text-foreground text-sm mb-0.5">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
