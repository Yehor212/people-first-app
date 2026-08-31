import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRY } from "@/types";
import { makeTestHabit } from "@/test/habitFixtures";
import { db } from "@/storage/db";

const logging = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { warn: logging.warn },
}));

vi.mock("@/hooks/useIndexedDB", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useIndexedDB")>();
  const boundary = await import("@/storage/accountBoundaryRuntime");
  return {
    ...actual,
    runWithDataWriteBarrier: async <T>(operation: () => Promise<T>): Promise<T> => {
      const committedValue = await operation();
      throw new actual.DataWriteBarrierPostCommitError(
        committedValue,
        boundary.captureOriginAccountBoundaryGeneration(),
        ["mounted-refresh"],
      );
    },
  };
});

import { commitHabitToggle } from "@/storage/habitCompletionCommit";

describe("durable habit completion post-commit recovery", () => {
  beforeEach(async () => {
    logging.warn.mockClear();
    await db.open();
    await db.habits.clear();
  });

  it("returns the exact committed value when only barrier finalization fails", async () => {
    const habit = makeTestHabit({ id: "habit-post-commit", entries: {} });
    await db.habits.put(habit);

    const result = await commitHabitToggle(
      habit.id,
      "2026-08-31",
      "quickTap",
    );

    expect(result.nextValue).toBe(ENTRY.YES_MANUAL);
    expect((await db.habits.get(habit.id))?.entries["2026-08-31"]?.value).toBe(
      ENTRY.YES_MANUAL,
    );
    expect(logging.warn).toHaveBeenCalledWith(
      expect.stringContaining("Durable completion committed"),
      ["mounted-refresh"],
    );
  });
});
