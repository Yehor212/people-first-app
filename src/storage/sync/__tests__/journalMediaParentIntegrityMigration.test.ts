import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260717123000_enforce_journal_media_parent_membership.sql";

describe("journal media parent membership migration", () => {
  it("fails closed on existing drift and guards metadata plus Storage writes", () => {
    const source = readFileSync(migrationPath, "utf8");

    expect(source).toContain("orphan_photo_membership_count");
    expect(source).toContain("orphan_audio_membership_count");
    expect(source).toContain("RAISE EXCEPTION");
    expect(source).toContain("enforce_journal_photo_parent_membership");
    expect(source).toContain("enforce_journal_audio_parent_membership");
    expect(source).toContain(
      "NEW.id::text = ANY (COALESCE(entries.photo_ids, '{}'::text[]))",
    );
    expect(source).toContain(
      "NEW.id::text = ANY (COALESCE(entries.audio_ids, '{}'::text[]))",
    );
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_photos_upload\"");
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_photos_select\"");
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_photos_update\"");
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_audio_upload\"");
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_audio_select\"");
    expect(source).toContain("DROP POLICY IF EXISTS \"journal_audio_update\"");
    expect(source).toContain("public.account_deletion_blocks");
    expect(source).toContain("split_part(storage.filename(name), '.', 1)");
    expect(source).toContain(
      "CREATE INDEX IF NOT EXISTS journal_photos_entry_id_idx",
    );
    expect(source).toContain(
      "CREATE INDEX IF NOT EXISTS journal_audio_entry_id_idx",
    );
    expect(source).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
