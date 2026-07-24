import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serviceSource = readFileSync("src/storage/journalStorageService.ts", "utf8");
const journalStorageSource = readFileSync("src/features/journal/journalStorage.ts", "utf8");
const audioValidationSource = readFileSync(
  "src/features/journal/journalAudioValidation.ts",
  "utf8",
);
const bucketMigration = readFileSync("supabase/migrations/20260215_journal_storage_buckets.sql", "utf8");
const encryptedBucketMigration = readFileSync("supabase/migrations/20260618130000_allow_encrypted_journal_media_storage.sql", "utf8");

describe("Journal media bucket limits", () => {
  it("keeps client upload limits aligned with Supabase iOS diary media buckets", () => {
    expect(bucketMigration).toContain("1048576");
    expect(bucketMigration).toContain("20971520");
    expect(serviceSource).toContain("const MAX_PHOTO_SIZE = 1 * 1024 * 1024");
    expect(audioValidationSource).toContain(
      "export const JOURNAL_AUDIO_MAX_BYTES = 20 * 1024 * 1024",
    );
    expect(serviceSource).toContain("const MAX_AUDIO_SIZE = JOURNAL_AUDIO_MAX_BYTES");
    expect(serviceSource).toContain("JOURNAL_AUDIO_MAX_BYTES,");
    expect(journalStorageSource).toContain("assertValidJournalAudio");
    expect(serviceSource).not.toContain("10 * 1024 * 1024");
    expect(serviceSource).not.toContain("25 * 1024 * 1024");
    expect(journalStorageSource).not.toContain("25 * 1024 * 1024");
  });

  it("allows encrypted journal media binary payloads without exposing plaintext media types", () => {
    expect(encryptedBucketMigration).toContain("application/octet-stream");
    expect(encryptedBucketMigration).toContain("journal-photos");
    expect(encryptedBucketMigration).toContain("journal-audio");
    expect(serviceSource).toContain('const ENCRYPTED_MEDIA_MIME = "application/octet-stream"');
    expect(serviceSource).toContain('const ENCRYPTED_MEDIA_EXTENSION = "bin"');
  });
});
