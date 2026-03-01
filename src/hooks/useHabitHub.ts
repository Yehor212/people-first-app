/**
 * useHabitHub — Derived data layer for the Habit Hub tab.
 *
 * Computes Loop-exact scores, filters active/archived habits.
 * All heavy computation inside useMemo — recalculates only when habits change.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Habit, HabitCategory } from '@/types';
import { computeHabitScore } from '@/lib/habitScore';
import { formatDate } from '@/lib/utils';
import { isHabitCompletedOnDate } from '@/lib/habits';

export type HabitSortOption = 'score' | 'name' | 'status' | 'color' | 'manual';

export interface UseHabitHubReturn {
  activeHabits: Habit[];
  archivedHabits: Habit[];
  todayHabits: Habit[];
  otherHabits: Habit[];
  scoresMap: Map<string, number>;
  overallScore: number;
  categoryFilter: HabitCategory | 'all';
  setCategoryFilter: (c: HabitCategory | 'all') => void;
  sortOption: HabitSortOption;
  setSortOption: (s: HabitSortOption) => void;
  selectedHabit: Habit | null;
  setSelectedHabit: (h: Habit | null) => void;
}

export function useHabitHub(habits: Habit[]): UseHabitHubReturn {
  const [categoryFilter, setCategoryFilter] = useState<HabitCategory | 'all'>('all');
  const [sortOption, setSortOption] = useState<HabitSortOption>('manual');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

  // Live date — updates at midnight if app stays open
  const [today, setToday] = useState(() => formatDate(new Date()));
  useEffect(() => {
    const check = () => {
      const now = formatDate(new Date());
      if (now !== today) setToday(now);
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [today]);

  // Split active vs archived
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

  // Compute scores for all habits
  const scoresMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of [...activeHabits, ...archivedHabits]) {
      map.set(h.id, computeHabitScore(h));
    }
    return map;
  }, [activeHabits, archivedHabits]);

  // Overall score = average of ACTIVE habit scores
  const overallScore = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    let sum = 0;
    for (const h of activeHabits) {
      sum += scoresMap.get(h.id) ?? 0;
    }
    return sum / activeHabits.length;
  }, [activeHabits, scoresMap]);

  // Filter and sort — all habits show as "today" (Loop doesn't split by due date)
  const { todayHabits, otherHabits } = useMemo(() => {
    const filtered = categoryFilter === 'all'
      ? activeHabits
      : activeHabits.filter(h => h.category === categoryFilter);

    const sortFn = (a: Habit, b: Habit) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'color':
          return a.color - b.color;
        case 'manual':
          return (a.position ?? 0) - (b.position ?? 0);
        case 'status': {
          const aComp = isHabitCompletedOnDate(a, today) ? 1 : 0;
          const bComp = isHabitCompletedOnDate(b, today) ? 1 : 0;
          if (aComp !== bComp) return aComp - bComp;
          return a.name.localeCompare(b.name);
        }
        case 'score':
        default: {
          // Incomplete first, then by score descending
          const aComp = isHabitCompletedOnDate(a, today) ? 1 : 0;
          const bComp = isHabitCompletedOnDate(b, today) ? 1 : 0;
          if (aComp !== bComp) return aComp - bComp;
          return (scoresMap.get(b.id) ?? 0) - (scoresMap.get(a.id) ?? 0);
        }
      }
    };

    const sorted = [...filtered].sort(sortFn);
    return { todayHabits: sorted, otherHabits: [] as Habit[] };
  }, [activeHabits, categoryFilter, today, scoresMap, sortOption]);

  return {
    activeHabits,
    archivedHabits,
    todayHabits,
    otherHabits,
    scoresMap,
    overallScore,
    categoryFilter,
    setCategoryFilter,
    sortOption,
    setSortOption,
    selectedHabit,
    setSelectedHabit,
  };
}
