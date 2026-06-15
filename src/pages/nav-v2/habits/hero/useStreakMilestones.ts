/**
 * useStreakMilestones — detects when any habit's current streak crosses a
 * research-backed milestone threshold and surfaces the habit for celebration.
 *
 * Thresholds (spec §3 — behavioral foundations):
 *   - 3  days: early-signal (Clear, *Atomic Habits* — first reward loop)
 *   - 7  days: week milestone (cultural anchor)
 *   - 21 days: the "21-day myth" — still meaningful as a pop-psychology hit
 *   - 66 days: Lally et al. 2010 median automaticity plateau
 *   - 100 days: long-run commitment marker
 *
 * Design:
 *   - Pure front-end detection; no persistence. Milestones are moments, not
 *     achievements. We detect a streak crossing and fire exactly once per
 *     habit per transition — then let V1 HabitCompletionCelebration handle
 *     the visuals.
 *   - Ref-based prev-streak tracking per habit id avoids re-firing on
 *     unrelated re-renders. When a new habit appears (never seen before),
 *     we seed its prev to the current streak — first tap only fires if
 *     streak increments into a threshold.
 *   - `clear()` is returned so callers can dismiss the celebration and
 *     re-arm the detector for the same habit (rare — would require the user
 *     to reset and re-hit in the same session).
 *
 * Law 15 (Component Isolation): this hook reads habits as a prop, not from
 * the store — the parent already has a subscription and knows when to
 * re-invoke. Keeps the hook pure and easy to test.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentStreak } from "@/lib/habitScore";
import { scheduleIdle } from "@/lib/scheduleIdle";
import type { Habit } from "@/types";

export const STREAK_MILESTONES: readonly number[] = [3, 7, 21, 66, 100] as const;

/** Pure: which milestone (if any) does this streak exactly equal? */
export function milestoneForStreak(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak) ? streak : null;
}

/** Pure: did a streak cross INTO a milestone this tick? */
export function didCrossMilestone(prev: number, next: number): number | null {
  if (next <= prev) return null;
  for (const m of STREAK_MILESTONES) {
    if (prev < m && next >= m) return m;
  }
  return null;
}

export interface StreakMilestoneEvent {
  habit: Habit;
  streak: number;
  milestone: number;
}

export interface UseStreakMilestonesResult {
  /** The pending milestone event, or null if nothing to celebrate right now. */
  event: StreakMilestoneEvent | null;
  /** Dismiss the current event (the caller calls this on celebration-done). */
  dismiss: () => void;
}

/**
 * Watches a habits array and emits exactly one event per streak transition
 * into a milestone threshold. Queued events are FIFO — if two habits cross
 * simultaneously, the second one surfaces after the first is dismissed.
 */
export function useStreakMilestones(habits: readonly Habit[]): UseStreakMilestonesResult {
  const prevStreaksRef = useRef<Map<string, number>>(new Map());
  const initialHabitsRef = useRef<readonly Habit[] | null>(null);
  const seededRef = useRef(false);
  const queueRef = useRef<StreakMilestoneEvent[]>([]);
  const [event, setEvent] = useState<StreakMilestoneEvent | null>(null);

  useEffect(() => {
    if (!seededRef.current && initialHabitsRef.current === null) {
      initialHabitsRef.current = habits;
    }

    let cancelled = false;
    const handle = scheduleIdle(() => {
      if (cancelled) return;
      const prev = prevStreaksRef.current;
      const surfaceNextEvent = () => {
        if (!event && queueRef.current.length > 0) {
          const next = queueRef.current.shift();
          if (next) setEvent(next);
        }
      };

      // First pass: seed the baseline so we don't celebrate streaks that existed
      // before the page mounted. If the user taps before the idle seed runs, compare
      // against the first snapshot so the legitimate crossing is not swallowed.
      if (!seededRef.current) {
        const initialHabits = initialHabitsRef.current;
        const initialStreaks = new Map<string, number>();

        if (initialHabits && initialHabits !== habits) {
          for (const h of initialHabits) {
            initialStreaks.set(h.id, getCurrentStreak(h));
          }
        }

        for (const h of habits) {
          const current = getCurrentStreak(h);
          const previous = initialStreaks.get(h.id);
          if (previous !== undefined) {
            const crossed = didCrossMilestone(previous, current);
            if (crossed !== null) {
              queueRef.current.push({ habit: h, streak: current, milestone: crossed });
            }
          }
          prev.set(h.id, current);
        }

        initialHabitsRef.current = null;
        seededRef.current = true;
        surfaceNextEvent();
        return;
      }

      for (const h of habits) {
        const current = getCurrentStreak(h);
        const previous = prev.get(h.id) ?? current;
        const crossed = didCrossMilestone(previous, current);
        if (crossed !== null) {
          queueRef.current.push({ habit: h, streak: current, milestone: crossed });
        }
        prev.set(h.id, current);
      }

      // Prune ids for deleted habits so memory doesn't leak
      const alive = new Set(habits.map((h) => h.id));
      for (const id of Array.from(prev.keys())) {
        if (!alive.has(id)) prev.delete(id);
      }

      // Surface one event at a time
      surfaceNextEvent();
    }, 1_200, 120);

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [habits, event]);

  const dismiss = useCallback(() => {
    setEvent(queueRef.current.shift() ?? null);
  }, []);

  return { event, dismiss };
}
