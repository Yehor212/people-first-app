import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { getNextToggleValue, setEntryValue } from "@/lib/habits";
import { ENTRY, type Habit, type HabitEntrySource } from "@/types";
import { db } from "@/storage/db";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";

export interface HabitToggleCommit {
  habit: Habit;
  nextValue: number;
}

/**
 * Durably writes one known habit-entry value under the same account-generation
 * fence used for binary toggles. Numerical completion publishers use this
 * instead of relying on asynchronous Zustand persistence.
 */
export async function commitHabitEntry(
  habitId: string,
  date: string,
  value: number,
  source: HabitEntrySource
): Promise<Habit> {
  const expectedGeneration = captureOriginAccountBoundaryGeneration();

  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
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
          value === ENTRY.UNKNOWN ? undefined : { loggedAt: new Date().toISOString(), source }
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
 * Commits exactly one habit-entry transition to Dexie before a caller can
 * publish it or run optional integrations. The account generation is checked
 * both sides of the durable write so a stale realm cannot publish a newer
 * account's local completion.
 */
export async function commitHabitToggle(
  habitId: string,
  date: string,
  source: HabitEntrySource
): Promise<HabitToggleCommit> {
  const expectedGeneration = captureOriginAccountBoundaryGeneration();

  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    assertOriginAccountBoundaryGeneration(expectedGeneration);

    return db.transaction("rw", db.habits, async () => {
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      const habit = await db.habits.get(habitId);
      if (!habit) {
        throw new Error(`Habit ${habitId} no longer exists`);
      }

      const nextValue = getNextToggleValue(habit.entries?.[date]?.value ?? ENTRY.UNKNOWN);
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
