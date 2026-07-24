import { useEffect, useState } from "react";
import { getToday } from "@/lib/utils";

const ROLLOVER_SETTLE_MS = 50;

export function getMillisecondsUntilNextJournalDay(now = new Date()): number {
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  return Math.max(ROLLOVER_SETTLE_MS, nextDay.getTime() - now.getTime() + ROLLOVER_SETTLE_MS);
}

export function useJournalToday(): string {
  const [today, setToday] = useState(getToday);

  useEffect(() => {
    let timerId: number | undefined;

    const refreshAndSchedule = () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      setToday((current) => {
        const next = getToday();
        return current === next ? current : next;
      });
      timerId = window.setTimeout(refreshAndSchedule, getMillisecondsUntilNextJournalDay());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAndSchedule();
    };

    refreshAndSchedule();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshAndSchedule);
    window.addEventListener("pageshow", refreshAndSchedule);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshAndSchedule);
      window.removeEventListener("pageshow", refreshAndSchedule);
    };
  }, []);

  return today;
}
