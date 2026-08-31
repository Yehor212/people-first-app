import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestHabit } from "@/test/habitFixtures";
import { db } from "@/storage/db";

const boundary = vi.hoisted(() => ({
  checks: 0,
  failAt: Number.POSITIVE_INFINITY,
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/storage/accountBoundaryRuntime")
  >();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: () => "captured-generation",
    assertOriginAccountBoundaryGeneration: () => {
      boundary.checks += 1;
      if (boundary.checks >= boundary.failAt) {
        throw new actual.AccountBoundaryChangedError();
      }
    },
  };
});

import { commitHabitToggle } from "@/storage/habitCompletionCommit";

describe("durable habit completion account boundary", () => {
  beforeEach(async () => {
    boundary.checks = 0;
    boundary.failAt = Number.POSITIVE_INFINITY;
    await db.open();
    await db.habits.clear();
  });

  it("rolls back the Dexie write when the account generation changes", async () => {
    const habit = makeTestHabit({ id: "habit-stale-generation", entries: {} });
    await db.habits.put(habit);
    // The current data-write barrier checks once before the callback, then the
    // completion primitive checks before and inside the transaction. Failing
    // the final post-write check must roll the transaction back.
    boundary.failAt = 4;

    await expect(
      commitHabitToggle(habit.id, "2026-08-31", "quickTap"),
    ).rejects.toMatchObject({ code: "ACCOUNT_BOUNDARY_CHANGED" });

    expect(boundary.checks).toBe(4);
    expect((await db.habits.get(habit.id))?.entries["2026-08-31"]).toBeUndefined();
  });
});
