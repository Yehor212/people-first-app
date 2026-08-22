import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";
import { createGratitudeSpaceCapture } from "../journalHubStorage";
import type { GratitudeEntry } from "@/types";

const entry: GratitudeEntry = {
  id: "gratitude-source-1",
  text: "PRIVATE_GRATITUDE_CANARY",
  date: "2026-08-08",
  timestamp: 100,
  updatedAt: 100,
};

describe("gratitude-to-journal projection release gate", () => {
  beforeEach(async () => {
    await db.transaction("rw", db.journalSpaces, db.journalSpaceCaptures, db.settings, async () => {
      await db.journalSpaces.clear();
      await db.journalSpaceCaptures.clear();
      await db.settings.delete(SK.JOURNAL_PASSWORD);
    });
  });

  it("stays disabled instead of racing two read-then-random projection writes", async () => {
    const results = await Promise.all([
      createGratitudeSpaceCapture(entry),
      createGratitudeSpaceCapture(entry),
    ]);

    expect(results).toEqual([null, null]);
    await expect(db.journalSpaceCaptures.count()).resolves.toBe(0);
    await expect(db.journalSpaces.count()).resolves.toBe(0);
  });

  it("does not partially write while the journal vault is locked", async () => {
    await db.settings.put({ key: SK.JOURNAL_PASSWORD, value: "protected" });

    await expect(createGratitudeSpaceCapture(entry)).resolves.toBeNull();
    await expect(db.journalSpaceCaptures.count()).resolves.toBe(0);
    await expect(db.journalSpaces.count()).resolves.toBe(0);
  });

  it("creates no projection row that backup, account switch, update, or delete can orphan", async () => {
    await expect(
      createGratitudeSpaceCapture({
        ...entry,
        text: "PRIVATE_UPDATED_GRATITUDE_CANARY",
        updatedAt: 200,
      })
    ).resolves.toBeNull();

    expect(JSON.stringify(await db.journalSpaceCaptures.toArray())).not.toContain("PRIVATE_");
  });
});
