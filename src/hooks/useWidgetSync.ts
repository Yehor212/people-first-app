import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { isNative } from '@/lib/platform';
import Widget, { type WidgetData } from '@/plugins/WidgetPlugin';
import type { Habit } from '@/types';
import { formatDate } from '@/lib/utils';

/**
 * Hook to automatically sync data with native widgets
 * Updates widgets whenever relevant data changes
 */
export function useWidgetSync(
  streak: number,
  habits: Habit[],
  focusMinutes: number,
  lastBadge?: string,
  isLoading?: boolean,
  currentMood?: string,
  moodLabel?: string
) {
  useEffect(() => {
    // Track if component is still mounted to prevent memory leaks
    let isMounted = true;

    // Only run on native platforms
    if (!isNative) {
      return;
    }

    // Skip if still loading data
    if (isLoading) {
      logger.log('[Widget] Skipping update - data still loading');
      return;
    }

    // Check if widgets are supported
    Widget.isSupported()
      .then(({ supported }) => {
        // Skip if unmounted or not supported
        if (!isMounted || !supported) return;

        try {
          const today = formatDate(new Date());

          // Calculate habits completed today (entry-based model)
          const habitsToday = habits.filter(habit => {
            const entry = habit.entries?.[today];
            if (!entry) return false;
            // Boolean: YES_MANUAL (2), Numerical: value >= target * 1000
            if (habit.habitType === 'numerical') {
              return entry.value >= (habit.targetValue || 1) * 1000;
            }
            return entry.value === 2;
          });

          // Prepare widget data
          const widgetData: WidgetData = {
            streak,
            habitsToday: habitsToday.length,
            habitsTotalToday: habits.length,
            focusMinutes,
            lastBadge,
            currentMood,
            moodLabel,
            habits: habits.slice(0, 5).map(habit => {
              const entry = habit.entries?.[today];
              const completed = habit.habitType === 'numerical'
                ? (entry?.value ?? 0) >= (habit.targetValue || 1) * 1000
                : entry?.value === 2;
              return { name: habit.name, completed };
            }),
          };

          logger.log('[Widget] Updating widget with data:', widgetData);

          // Update widget
          Widget.updateWidget(widgetData).catch(err => {
            if (isMounted) {
              logger.error('[Widget] Failed to update widget:', err);
            }
          });
        } catch (error) {
          if (isMounted) {
            logger.error('[Widget] Error preparing widget data:', error);
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          logger.error('[Widget] Failed to check widget support:', err);
        }
      });

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMounted = false;
    };
  }, [streak, habits, focusMinutes, lastBadge, isLoading, currentMood, moodLabel]);
}

/**
 * Hook to get current widget data
 * Useful for debugging or displaying widget preview
 */
export function useWidgetData() {
  const [data, setData] = useState<WidgetData | null>(null);

  useEffect(() => {
    let isMounted = true;

    Widget.getWidgetData()
      .then(widgetData => {
        if (isMounted) {
          setData(widgetData);
        }
      })
      .catch(err => {
        if (isMounted) {
          logger.error('Failed to get widget data:', err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return data;
}
