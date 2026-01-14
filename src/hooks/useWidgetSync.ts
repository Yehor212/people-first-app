import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import Widget, { type WidgetData } from '@/plugins/WidgetPlugin';
import type { Habit } from '@/types';

/**
 * Hook to automatically sync data with native widgets
 * Updates widgets whenever relevant data changes
 */
export function useWidgetSync(
  streak: number,
  habits: Habit[],
  focusMinutes: number,
  lastBadge?: string
) {
  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Check if widgets are supported
    Widget.isSupported().then(({ supported }) => {
      if (!supported) return;

      try {
        const today = new Date().toISOString().split('T')[0];

        // Calculate habits completed today
        const habitsToday = habits.filter(habit => {
          if (!habit.completedDates) return false;
          return habit.completedDates.includes(today);
        });

        // Prepare widget data
        const widgetData: WidgetData = {
          streak,
          habitsToday: habitsToday.length,
          habitsTotalToday: habits.length,
          focusMinutes,
          lastBadge,
          habits: habits.slice(0, 5).map(habit => ({
            name: habit.name,
            completed: habit.completedDates?.includes(today) ?? false,
          })),
        };

        // Update widget
        Widget.updateWidget(widgetData).catch(err => {
          console.error('Failed to update widget:', err);
        });
      } catch (error) {
        console.error('Error preparing widget data:', error);
      }
    });
  }, [streak, habits, focusMinutes, lastBadge]);
}

/**
 * Hook to get current widget data
 * Useful for debugging or displaying widget preview
 */
export function useWidgetData() {
  const [data, setData] = useState<WidgetData | null>(null);

  useEffect(() => {
    Widget.getWidgetData()
      .then(setData)
      .catch(err => {
        console.error('Failed to get widget data:', err);
      });
  }, []);

  return data;
}
