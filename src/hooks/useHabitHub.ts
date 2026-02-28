/**
 * useHabitHub — Derived data layer for the Habit Hub tab.
 *
 * Computes scores, filters active/archived/today/other habits.
 * All heavy computation inside useMemo — recalculates only when habits change.
 */

import { useMemo, useState } from 'react';
import type { Habit, HabitCategory } from '@/types';
import { computeHabitScore, isHabitDueOnDate } from '@/lib/habitScore';
import { formatDate } from '@/lib/utils';

export interface UseHabitHubReturn {
  activeHabits: Habit[];
  archivedHabits: Habit[];
  todayHabits: Habit[];
  otherHabits: Habit[];
  scoresMap: Map<string, number>;
  overallScore: number;
  categoryFilter: HabitCategory | 'all';
  setCategoryFilter: (c: HabitCategory | 'all') => void;
  selectedHabit: Habit | null;
  setSelectedHabit: (h: Habit | null) => void;
}

export function useHabitHub(habits: Habit[]): UseHabitHubReturn {
  const [categoryFilter, setCategoryFilter] = useState<HabitCategory | 'all'>('all');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

  const today = useMemo(() => formatDate(new Date()), []);

  // Split active vs archived (single pass)
  const { activeHabits, archivedHabits } = useMemo(() => {
    const active: Habit[] = [];
    const archived: Habit[] = [];
    for (const h of habits) {
      if (h.isArchived) {
        archived.push(h);
      } else {
        active.push(h);
      }
    }
    return { activeHabits: active, archivedHabits: archived };
  }, [habits]);

  // Compute scores for all active habits (single pass, O(habits * days_per_habit))
  const scoresMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of activeHabits) {
      map.set(h.id, computeHabitScore(h));
    }
    return map;
  }, [activeHabits]);

  // Overall score = average of all active habit scores
  const overallScore = useMemo(() => {
    if (scoresMap.size === 0) return 0;
    let sum = 0;
    scoresMap.forEach(v => { sum += v; });
    return sum / scoresMap.size;
  }, [scoresMap]);

  // Split today vs other, apply category filter
  const { todayHabits, otherHabits } = useMemo(() => {
    const filtered = categoryFilter === 'all'
      ? activeHabits
      : activeHabits.filter(h => h.category === categoryFilter);

    const todayArr: Habit[] = [];
    const otherArr: Habit[] = [];

    for (const h of filtered) {
      if (isHabitDueOnDate(h, today)) {
        todayArr.push(h);
      } else {
        otherArr.push(h);
      }
    }

    // Sort today's habits: incomplete first, then by score descending
    const completedSet = new Set<string>();
    for (const h of todayArr) {
      if (h.completedDates?.includes(today)) completedSet.add(h.id);
    }
    todayArr.sort((a, b) => {
      const aComplete = completedSet.has(a.id) ? 1 : 0;
      const bComplete = completedSet.has(b.id) ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;
      return (scoresMap.get(b.id) ?? 0) - (scoresMap.get(a.id) ?? 0);
    });

    return { todayHabits: todayArr, otherHabits: otherArr };
  }, [activeHabits, categoryFilter, today, scoresMap]);

  return {
    activeHabits,
    archivedHabits,
    todayHabits,
    otherHabits,
    scoresMap,
    overallScore,
    categoryFilter,
    setCategoryFilter,
    selectedHabit,
    setSelectedHabit,
  };
}
