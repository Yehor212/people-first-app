import { useState, useEffect } from 'react';
import { getToday } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { getCurrentTimeOfDay } from './types';
import type { TimeOfDay } from './types';

interface UseDateTimeTrackingReturn {
  today: string;
  currentTimeOfDay: TimeOfDay;
}

export function useDateTimeTracking(): UseDateTimeTrackingReturn {
  const [today, setToday] = useState(getToday());
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState(getCurrentTimeOfDay());

  useEffect(() => {
    const checkDateChange = () => {
      const newDate = getToday();
      const newTimeOfDay = getCurrentTimeOfDay();

      setToday(prev => {
        if (prev !== newDate) {
          logger.log('[MoodTracker] Date changed:', prev, '->', newDate);
          return newDate;
        }
        return prev;
      });

      setCurrentTimeOfDay(prev => {
        if (prev !== newTimeOfDay) {
          return newTimeOfDay;
        }
        return prev;
      });
    };

    checkDateChange();

    const interval = setInterval(checkDateChange, 60000);

    const handleFocus = () => checkDateChange();
    window.addEventListener('focus', handleFocus);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDateChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return { today, currentTimeOfDay };
}
