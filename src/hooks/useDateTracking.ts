import { useEffect } from 'react';
import { useAppStore } from '@/stores';
import { getToday } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Tracks current date and detects midnight changes via interval + window focus.
 */
export function useDateTracking(): void {
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);

  useEffect(() => {
    const checkDateChange = () => {
      const newDate = getToday();
      if (newDate !== currentDate) {
        logger.log('[AppInit] Date changed from', currentDate, 'to', newDate);
        setCurrentDate(newDate);
      }
    };

    // Check every minute
    const interval = setInterval(checkDateChange, 60000);

    // Also check on window focus (in case device was sleeping)
    const handleFocus = () => checkDateChange();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentDate, setCurrentDate]);
}
