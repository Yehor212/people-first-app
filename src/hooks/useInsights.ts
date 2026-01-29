/**
 * useInsights Hook
 *
 * Generates and manages personalized insights from user data
 * Updates when data changes or on a daily basis
 */

import { useMemo, useEffect, useState } from 'react';
import type { MoodEntry, Habit, FocusSession, Insight } from '@/types';
import { generateInsights } from '@/lib/insightsEngine';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';

interface UseInsightsOptions {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  autoRefresh?: boolean; // Refresh insights daily
}

/**
 * Custom hook for generating and managing insights
 * Insights are memoized and only regenerate when data changes significantly
 */
export function useInsights({
  moods,
  habits,
  focusSessions,
  autoRefresh = true,
}: UseInsightsOptions) {
  const [lastGeneratedDate, setLastGeneratedDate] = useState<string>('');

  // Get today's date (YYYY-MM-DD)
  const getToday = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Generate insights (memoized)
  const insights = useMemo(() => {
    try {
      logger.log('[useInsights] Generating insights...', {
        moods: moods.length,
        habits: habits.length,
        focusSessions: focusSessions.length,
      });

      const generated = generateInsights(moods, habits, focusSessions);

      logger.log('[useInsights] Generated insights:', {
        count: generated.length,
        types: generated.map(i => i.type),
      });

      return generated;
    } catch (error) {
      logger.error('[useInsights] Failed to generate insights:', error);
      return [];
    }
  }, [moods, habits, focusSessions]);

  // Check if insights should be refreshed (daily)
  useEffect(() => {
    if (!autoRefresh) return;

    const today = getToday();
    const lastDate = localStorage.getItem('zenflow-insights-last-generated');

    // Regenerate if it's a new day
    if (lastDate !== today && insights.length > 0) {
      logger.log('[useInsights] New day detected, insights will refresh');
      localStorage.setItem('zenflow-insights-last-generated', today);
      setLastGeneratedDate(today);
    }
  }, [autoRefresh, insights.length]);

  // Track insights visibility
  const [dismissedInsights, setDismissedInsights] = useState<string[]>(() => {
    const stored = localStorage.getItem('zenflow-insights-dismissed');
    return safeJsonParse<string[]>(stored, []);
  });

  // Dismiss an insight
  const dismissInsight = (insightId: string) => {
    const updated = [...dismissedInsights, insightId];
    setDismissedInsights(updated);
    localStorage.setItem('zenflow-insights-dismissed', JSON.stringify(updated));
  };

  // Clear dismissed insights (for testing or reset)
  const clearDismissed = () => {
    setDismissedInsights([]);
    localStorage.removeItem('zenflow-insights-dismissed');
  };

  // Filter out dismissed insights
  const visibleInsights = insights.filter(
    insight => !dismissedInsights.includes(insight.id)
  );

  // Categorize insights by type
  const insightsByType = useMemo(() => {
    return {
      habits: visibleInsights.filter(i => i.type === 'mood-habit-correlation'),
      focus: visibleInsights.filter(i => i.type === 'focus-pattern'),
      timing: visibleInsights.filter(i => i.type === 'habit-timing'),
      tags: visibleInsights.filter(i => i.type === 'mood-tag'),
      energy: visibleInsights.filter(i => i.type === 'energy-pattern'),
    };
  }, [visibleInsights]);

  // Get top insight (highest confidence)
  const topInsight = visibleInsights.length > 0 ? visibleInsights[0] : null;

  // Check if user has enough data for insights
  const hasEnoughData = moods.length >= 7 || habits.length >= 1 || focusSessions.length >= 3;

  return {
    // All insights
    insights: visibleInsights,
    allInsights: insights, // Including dismissed

    // Categorized
    insightsByType,
    topInsight,

    // Actions
    dismissInsight,
    clearDismissed,

    // Status
    hasEnoughData,
    isLoading: false, // Insights are generated synchronously
    lastGeneratedDate,
    totalGenerated: insights.length,
    visibleCount: visibleInsights.length,
    dismissedCount: dismissedInsights.length,
  };
}
