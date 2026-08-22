import { beforeEach, describe, expect, it } from "vitest";
import { ENTRY } from "@/types";
import { makeTestHabit } from "@/test/habitFixtures";
import { db } from "@/storage/db";
import { commitHabitEntry, commitHabitToggle } from "@/storage/habitCompletionCommit";

describe("commitHabitToggle", () => {
  beforeEach(async () => {
    await db.open();
    await db.habits.clear();
  });

  it("returns only after one durable completion is present in Dexie", async () => {
    const habit = makeTestHabit({ id: "habit-t175", entries: {} });
    await db.habits.put(habit);

    const committed = await commitHabitToggle("habit-t175", "2026-08-20", "quickTap");

    expect(committed.nextValue).toBe(ENTRY.YES_MANUAL);
    expect((await db.habits.get("habit-t175"))?.entries["2026-08-20"]?.value).toBe(
      ENTRY.YES_MANUAL
    );
  });

  it("durably writes a numerical completion before returning it to a publisher", async () => {
    const habit = makeTestHabit({
      id: "habit-t175-numerical",
      habitType: "numerical",
      entries: {},
    });
    await db.habits.put(habit);

    const committed = await commitHabitEntry(
      "habit-t175-numerical",
      "2026-08-20",
      2500,
      "exactInput"
    );

    expect(committed.entries["2026-08-20"]?.value).toBe(2500);
    expect((await db.habits.get("habit-t175-numerical"))?.entries["2026-08-20"]?.value).toBe(2500);
  });
});
