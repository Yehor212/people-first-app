import { useEffect } from 'react';
import { useUIStore, useUserDataStore } from '@/stores';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';

/**
 * Auto-shows weekly report on Monday if not already shown this week.
 */
export function useWeeklyReportTrigger(isLoading: boolean): void {
  const onboardingComplete = useUserDataStore(s => s.onboardingComplete);

  useEffect(() => {
    if (!onboardingComplete || isLoading) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkWeeklyReport = () => {
      const lastShown = storageGetRaw(SK.WEEKLY_REPORT);
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Function to check if lastShown is in a different week
      const isNewWeek = (lastShownDate: string) => {
        const last = new Date(lastShownDate);
        const lastMonday = new Date(last);
        lastMonday.setDate(last.getDate() - (last.getDay() === 0 ? 6 : last.getDay() - 1));
        lastMonday.setHours(0, 0, 0, 0);

        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        thisMonday.setHours(0, 0, 0, 0);

        return lastMonday.getTime() !== thisMonday.getTime();
      };

      // Show on Monday (1) if not shown this week
      if (dayOfWeek === 1 && (!lastShown || isNewWeek(lastShown))) {
        // Delay to let data load
        timeoutId = setTimeout(() => {
          useUIStore.getState().openModal('showWeeklyReport');
          storageSetRaw(SK.WEEKLY_REPORT, today.toISOString());
        }, 1000);
      }
    };

    checkWeeklyReport();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onboardingComplete, isLoading]);
}
