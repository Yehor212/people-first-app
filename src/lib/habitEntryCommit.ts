import { persistHabitSourceRecord } from "@/features/automation/automationSourcePersistence";
import {
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
} from "@/storage/accountBoundaryRuntime";
import type { Habit } from "@/types";

type HabitPublisher = (value: Habit[] | ((previous: Habit[]) => Habit[])) => void;

export interface CommitHabitEntryDependencies {
  setHabits: HabitPublisher;
  persistHabit?: typeof persistHabitSourceRecord;
  assertAccountBoundaryGeneration?: typeof assertOriginAccountBoundaryGeneration;
  onCompleted?: (habit: Habit) => void;
  onCommitted?: (habit: Habit) => void;
  entryDate?: string;
}

function habitEntriesEqual(left: Habit["entries"], right: Habit["entries"]): boolean {
  const leftDates = Object.keys(left).sort();
  const rightDates = Object.keys(right).sort();
  if (leftDates.length !== rightDates.length) return false;

  return leftDates.every((date, index) => {
    if (date !== rightDates[index]) return false;
    const leftEntry = left[date];
    const rightEntry = right[date];
    return (
      leftEntry.value === rightEntry?.value &&
      leftEntry.notes === rightEntry.notes &&
      leftEntry.loggedAt === rightEntry.loggedAt &&
      leftEntry.source === rightEntry.source
    );
  });
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
    assertAccountBoundaryGeneration = assertOriginAccountBoundaryGeneration,
    onCompleted,
    onCommitted,
    entryDate,
  }: CommitHabitEntryDependencies
): Promise<Habit> {
  const sessionGeneration = captureAccountSessionTransitionGeneration();
  const persisted = await persistHabit(nextHabit, completionDate, entryDate);
  assertAccountBoundaryGeneration(persisted.accountBoundaryGeneration);
  assertAccountSessionTransitionGeneration(sessionGeneration);
  const committedHabit = persisted.habit ?? nextHabit;
  let publicationObserved = false;
  let duplicatePublication = false;
  setHabits((previous) => {
    publicationObserved = true;
    const current = previous.find((habit) => habit.id === committedHabit.id);
    if (
      current !== undefined &&
      current.updatedAt === committedHabit.updatedAt &&
      habitEntriesEqual(current.entries, committedHabit.entries)
    ) {
      duplicatePublication = true;
      return previous;
    }
    return previous.map((habit) => (habit.id === committedHabit.id ? committedHabit : habit));
  });
  if (publicationObserved && duplicatePublication) return committedHabit;
  if (completionDate !== null) onCompleted?.(committedHabit);
  onCommitted?.(committedHabit);
  return committedHabit;
}
