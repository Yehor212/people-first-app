/**
 * InsightsPanel - Main insights display component
 *
 * Shows personalized data-driven insights about user patterns
 * Collapsible design to avoid overwhelming the user
 */

import { useState } from 'react';
import type { MoodEntry, Habit, FocusSession } from '@/types';
import { useInsights } from '@/hooks/useInsights';
import { InsightCard } from './InsightCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, ChevronDown, ChevronUp, X, Info } from 'lucide-react';

interface InsightsPanelProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  compact?: boolean; // Show only top 3 insights
}

export function InsightsPanel({
  moods,
  habits,
  focusSessions,
  compact = false,
}: InsightsPanelProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const {
    insights,
    topInsight,
    dismissInsight,
    hasEnoughData,
    visibleCount,
    totalGenerated,
  } = useInsights({
    moods,
    habits,
    focusSessions,
    autoRefresh: true,
  });

  // Don't show panel if no data
  if (!hasEnoughData) {
    return (
      <div className="bg-card rounded-2xl p-6 zen-shadow-card border border-border">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {t.insightsTitle || 'Personal Insights'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.insightsNotEnoughData || 'Keep tracking your mood, habits, and focus for a week to unlock personalized insights about your patterns.'}
            </p>
            <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${moods.length >= 7 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{moods.length}/7 {t.insightsMoodEntries || 'mood entries'}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${habits.length >= 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{habits.length}/1 {t.insightsHabitCount || 'habit'}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${focusSessions.length >= 3 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>{focusSessions.length}/3 {t.insightsFocusSessions || 'focus sessions'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No insights generated (data exists but no patterns found)
  if (visibleCount === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 zen-shadow-card border border-border">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {t.insightsTitle || 'Personal Insights'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t.insightsNoPatterns || 'No strong patterns detected yet. Keep tracking consistently to discover what works best for you!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayInsights = compact ? insights.slice(0, 3) : insights;
  const hasMore = insights.length > 3 && compact;

  return (
    <div className="bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">
              {t.insightsTitle || 'Personal Insights'}
            </h3>
            {visibleCount > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                {visibleCount}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            aria-expanded={showHelp}
            aria-label={t.insightsHelpTitle || 'About Insights'}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Help text */}
        {showHelp && (
          <div className="mt-3 p-3 bg-card rounded-xl text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground mb-1">
              {t.insightsHelpTitle || 'About Insights'}
            </p>
            <p>
              {t.insightsHelp1 || 'Insights are generated from your personal data using statistical analysis.'}
            </p>
            <p>
              {t.insightsHelp2 || 'All analysis happens locally on your device - your data never leaves.'}
            </p>
            <p>
              {t.insightsHelp3 || 'Patterns with higher confidence are shown first.'}
            </p>
          </div>
        )}
      </div>

      {/* Insights List */}
      <div className="p-4 space-y-3">
        {displayInsights.map((insight, index) => (
          <div key={insight.id} className="relative">
            <InsightCard insight={insight} />

            {/* Dismiss button */}
            <button
              onClick={() => dismissInsight(insight.id)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground transition-colors zen-shadow-sm opacity-0 group-hover:opacity-100"
              aria-label={t.insightsDismiss || 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Expand/Collapse for compact mode */}
        {compact && hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            {isExpanded ? (
              <>
                <span>{t.insightsShowLess || 'Show less'}</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>
                  {t.insightsShowMore || `Show ${insights.length - 3} more insights`}
                </span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        {/* All insights expanded */}
        {compact && isExpanded && (
          <div className="space-y-3 pt-3 border-t border-border">
            {insights.slice(3).map(insight => (
              <div key={insight.id} className="relative group">
                <InsightCard insight={insight} />
                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground transition-colors zen-shadow-sm opacity-0 group-hover:opacity-100"
                  aria-label={t.insightsDismiss || 'Dismiss'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {totalGenerated > visibleCount && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground text-center">
            {t.insightsDismissedCount || `${totalGenerated - visibleCount} insights dismissed`}
          </p>
        </div>
      )}
    </div>
  );
}
