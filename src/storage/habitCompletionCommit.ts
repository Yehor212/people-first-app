import {
  isDataWriteBarrierPostCommitError,
  runWithDataWriteBarrier,
} from "@/hooks/useIndexedDB";
import { getNextToggleValue, setEntryValue } from "@/lib/habits";
import { logger } from "@/lib/logger";
import { ENTRY, type Habit, type HabitEntrySource } from "@/types";
import { db } from "@/storage/db";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";

export interface HabitToggleCommit {
  habit: Habit;
  nextValue: number;
}

async function runDurableHabitCommit<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await runWithDataWriteBarrier(operation);
  } catch (error) {
    if (!isDataWriteBarrierPostCommitError<T>(error)) throw error;
    assertOriginAccountBoundaryGeneration(error.capturedOriginGeneration);
    logger.warn(
      "[habitCompletionCommit] Durable completion committed with incomplete post-commit finalization:",
      error.issueKinds,
    );
    return error.committedValue;
  }
}

/**
 * Durably writes one known habit-entry value before a caller publishes it.
 * The account-generation fence prevents a stale realm from writing into a
 * newer account's local data.
 */
export async function commitHabitEntry(
  habitId: string,
  date: string,
  value: number,
  source: HabitEntrySource,
): Promise<Habit> {
  const expectedGeneration = captureOriginAccountBoundaryGeneration();

  return runDurableHabitCommit(async () => {
    assertOriginAccountBoundaryGeneration(expectedGeneration);

    return db.transaction("rw", db.habits, async () => {
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      const habit = await db.habits.get(habitId);
      if (!habit) {
        throw new Error(`Habit ${habitId} no longer exists`);
      }

      const committedHabit: Habit = {
        ...habit,
        entries: setEntryValue(
          habit.entries || {},
          date,
          value,
          undefined,
          value === ENTRY.UNKNOWN
            ? undefined
            : { loggedAt: new Date().toISOString(), source },
        ),
        updatedAt: new Date().toISOString(),
      };

      await db.habits.put(committedHabit);
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      return committedHabit;
    });
  });
}

/**
 * Commits exactly one binary habit-entry transition to Dexie before a caller
 * can publish it or run optional integrations.
 */
export async function commitHabitToggle(
  habitId: string,
  date: string,
  source: HabitEntrySource,
): Promise<HabitToggleCommit> {
  const expectedGeneration = captureOriginAccountBoundaryGeneration();

  return runDurableHabitCommit(async () => {
    assertOriginAccountBoundaryGeneration(expectedGeneration);

    return db.transaction("rw", db.habits, async () => {
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      const habit = await db.habits.get(habitId);
      if (!habit) {
        throw new Error(`Habit ${habitId} no longer exists`);
      }

      const nextValue = getNextToggleValue(
        habit.entries?.[date]?.value ?? ENTRY.UNKNOWN,
      );
      const committedHabit: Habit = {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, nextValue, undefined, {
          loggedAt: new Date().toISOString(),
          source,
        }),
        updatedAt: new Date().toISOString(),
      };

      await db.habits.put(committedHabit);
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      return { habit: committedHabit, nextValue };
    });
  });
}
