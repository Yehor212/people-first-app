import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serviceSource = readFileSync("src/storage/journalStorageService.ts", "utf8");
const journalStorageSource = readFileSync("src/features/journal/journalStorage.ts", "utf8");
const bucketMigration = readFileSync("supabase/migrations/20260215_journal_storage_buckets.sql", "utf8");

describe("Journal media bucket limits", () => {
  it("keeps client upload limits aligned with Supabase iOS diary media buckets", () => {
    expect(bucketMigration).toContain("1048576");
    expect(bucketMigration).toContain("20971520");
    expect(serviceSource).toContain("const MAX_PHOTO_SIZE = 1 * 1024 * 1024");
    expect(serviceSource).toContain("const MAX_AUDIO_SIZE = 20 * 1024 * 1024");
    expect(journalStorageSource).toContain("const MAX_AUDIO_SIZE = 20 * 1024 * 1024");
    expect(serviceSource).not.toContain("10 * 1024 * 1024");
    expect(serviceSource).not.toContain("25 * 1024 * 1024");
    expect(journalStorageSource).not.toContain("25 * 1024 * 1024");
  });
});
