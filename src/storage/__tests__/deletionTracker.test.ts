import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import { getDeletedHabitIds, trackDeletedHabitId } from "@/storage/deletionTracker";

describe("deletionTracker", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
  });

  it("exposes a just-started habit deletion before the IndexedDB write settles", async () => {
    const id = `habit-race-${Date.now()}`;

    const tracking = trackDeletedHabitId(id);
    const idsDuringWrite = await getDeletedHabitIds();

    expect(idsDuringWrite.has(id)).toBe(true);
    await tracking;

    const idsAfterWrite = await getDeletedHabitIds();
    expect(idsAfterWrite.has(id)).toBe(true);
  });
});
