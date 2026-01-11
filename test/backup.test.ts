import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import { exportBackup, importBackup, BACKUP_SCHEMA_VERSION } from "@/storage/backup";

describe("backup", () => {
  beforeEach(async () => {
    await db.transaction("rw", db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, async () => {
      await db.moods.clear();
      await db.habits.clear();
      await db.focusSessions.clear();
      await db.gratitudeEntries.clear();
      await db.settings.clear();
    });
  });

  it("exports schema version and device id", async () => {
    const payload = await exportBackup();
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(payload.createdAt).toBeTruthy();
    expect(payload.deviceId).toBeTruthy();
  });

  it("merges backups and reports added/updated/skipped", async () => {
    await db.moods.add({
      id: "m1",
      mood: "good",
      date: "2026-01-01",
      timestamp: 1
    });

    const payload = {
      schemaVersion: 2 as const,
      createdAt: new Date().toISOString(),
      deviceId: "device_test",
      data: {
        moods: [
          { id: "m1", mood: "great", date: "2026-01-01", timestamp: 2 },
          { id: "m2", mood: "okay", date: "2026-01-02", timestamp: 3 }
        ],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: []
      }
    };

    const report = await importBackup(payload, "merge");
    expect(report.moods.added).toBe(1);
    expect(report.moods.updated).toBe(1);
    expect(report.moods.skipped).toBe(0);

    const updated = await db.moods.get("m1");
    expect(updated?.mood).toBe("great");
  });
});
