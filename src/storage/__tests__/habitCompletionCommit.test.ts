import { beforeEach, describe, expect, it } from "vitest";
import { ENTRY } from "@/types";
import { makeTestHabit } from "@/test/habitFixtures";
import { db } from "@/storage/db";
import { commitHabitEntry, commitHabitToggle } from "@/storage/habitCompletionCommit";

describe("durable habit completion commits", () => {
  beforeEach(async () => {
    await db.open();
    await db.habits.clear();
  });

  it("returns only after one boolean completion is durable in Dexie", async () => {
    const habit = makeTestHabit({ id: "habit-durable-toggle", entries: {} });
    await db.habits.put(habit);

    const committed = await commitHabitToggle(
      habit.id,
      "2026-08-31",
      "quickTap",
    );

    expect(committed.nextValue).toBe(ENTRY.YES_MANUAL);
    expect((await db.habits.get(habit.id))?.entries["2026-08-31"]?.value).toBe(
      ENTRY.YES_MANUAL,
    );
  });

  it("returns only after one numerical completion is durable in Dexie", async () => {
    const habit = makeTestHabit({
      id: "habit-durable-numerical",
      habitType: "numerical",
      entries: {},
    });
    await db.habits.put(habit);

    const committed = await commitHabitEntry(
      habit.id,
      "2026-08-31",
      2500,
      "exactInput",
    );

    expect(committed.entries["2026-08-31"]?.value).toBe(2500);
    expect((await db.habits.get(habit.id))?.entries["2026-08-31"]?.value).toBe(2500);
  });

  it("fails without creating a record when the habit no longer exists", async () => {
    await expect(
      commitHabitToggle("missing-habit", "2026-08-31", "quickTap"),
    ).rejects.toThrow("Habit missing-habit no longer exists");
    expect(await db.habits.count()).toBe(0);
  });
});
