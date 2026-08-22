import { persistHabitSourceRecord } from "@/features/automation/automationSourcePersistence";
import type { Habit } from "@/types";

type HabitPublisher = (value: Habit[] | ((previous: Habit[]) => Habit[])) => void;

export interface CommitHabitEntryDependencies {
  setHabits: HabitPublisher;
  persistHabit?: typeof persistHabitSourceRecord;
  onCompleted?: (habit: Habit) => void;
  onCommitted?: (habit: Habit) => void;
}

/**
 * One persistence-first publication boundary shared by the legacy and V2
 * habit surfaces. Surface-specific rewards and sync work run only after the
 * authoritative local write succeeds.
 */
export async function commitHabitEntry(
  nextHabit: Habit,
  completionDate: string | null,
  {
    setHabits,
    persistHabit = persistHabitSourceRecord,
    onCompleted,
    onCommitted,
  }: CommitHabitEntryDependencies,
): Promise<Habit> {
  await persistHabit(nextHabit, completionDate);
  setHabits((previous) =>
    previous.map((habit) => (habit.id === nextHabit.id ? nextHabit : habit)),
  );
  if (completionDate !== null) onCompleted?.(nextHabit);
  onCommitted?.(nextHabit);
  return nextHabit;
}
