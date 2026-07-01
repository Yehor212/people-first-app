/**
 * HabitHubTab — thin wrapper for the Habit Hub experience.
 * Receives shell data and delegates list rendering to HabitHubList.
 */

import type { Habit } from '@/types';
import { HabitHubList } from './HabitHubList';

interface HabitHubTabProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  onUpdateHabit: (habit: Habit) => void;
  onArchiveHabit: (habitId: string) => void;
  onUnarchiveHabit: (habitId: string) => void;
  onSkipHabit: (habitId: string, date: string) => void;
  onUnskipHabit: (habitId: string, date: string) => void;
}

export function HabitHubTab({
  habits,
  onToggleHabit,
  onAdjustHabit,
  onAddHabit,
  onDeleteHabit,
  onUpdateHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onSkipHabit,
  onUnskipHabit,
}: HabitHubTabProps) {
  return (
    <div className="motion-safe:animate-tab-enter pt-2">
      <HabitHubList
        habits={habits}
        onToggleHabit={onToggleHabit}
        onAdjustHabit={onAdjustHabit}
        onAddHabit={onAddHabit}
        onDeleteHabit={onDeleteHabit}
        onUpdateHabit={onUpdateHabit}
        onArchiveHabit={onArchiveHabit}
        onUnarchiveHabit={onUnarchiveHabit}
        onSkipHabit={onSkipHabit}
        onUnskipHabit={onUnskipHabit}
      />
    </div>
  );
}
