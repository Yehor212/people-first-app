import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const generatedTypesPath = resolve(process.cwd(), "src/types/supabase.ts");

function readIntegrityMigration(): string {
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith("_journal_cloud_write_integrity.sql")
  );

  expect(migrationName).toBeDefined();
  return readFileSync(resolve(migrationsDir, migrationName!), "utf8");
}

function readMediaConstraintRepairMigration(): string {
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith("_complete_journal_media_foreign_keys.sql")
  );

  expect(migrationName).toBeDefined();
  return readFileSync(resolve(migrationsDir, migrationName!), "utf8");
}

describe("journal cloud integrity migration", () => {
  it("fails closed instead of deleting orphan embeddings during deployment", () => {
    const sql = readIntegrityMigration();

    expect(sql).toMatch(/select\s+count\(\*\)[\s\S]*where\s+not\s+exists/i);
    expect(sql).toMatch(/raise\s+exception\s+'Journal embedding integrity preflight failed/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.journal_embeddings\s+as\s+embeddings/i);
  });

  it("cascades embedding deletion from the owning journal entry", () => {
    const sql = readIntegrityMigration();

    expect(sql).toMatch(/foreign key\s*\(entry_id\)/i);
    expect(sql).toMatch(/references\s+public\.journal_entries\s*\(id\)\s+on delete cascade/i);
  });

  it("fails closed on orphan media metadata before adding entry cascades", () => {
    const sql = readIntegrityMigration();

    expect(sql).toMatch(/Journal photo integrity preflight failed/i);
    expect(sql).toMatch(/Journal audio integrity preflight failed/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.journal_(photos|audio)/i);
    expect(sql).toMatch(
      /alter table public\.journal_photos[\s\S]*foreign key \(entry_id\)[\s\S]*references public\.journal_entries\(id\)[\s\S]*on delete cascade/i,
    );
    expect(sql).toMatch(
      /alter table public\.journal_audio[\s\S]*foreign key \(entry_id\)[\s\S]*references public\.journal_entries\(id\)[\s\S]*on delete cascade/i,
    );
  });

  it("keeps generated Supabase relationships aligned with the new journal cascades", () => {
    const generatedTypes = readFileSync(generatedTypesPath, "utf8");

    for (const foreignKeyName of [
      "journal_audio_entry_id_fkey",
      "journal_embeddings_entry_id_fkey",
      "journal_photos_entry_id_fkey",
    ]) {
      expect(generatedTypes).toContain(`foreignKeyName: "${foreignKeyName}"`);
    }

    expect(generatedTypes).toMatch(
      /foreignKeyName: "journal_embeddings_entry_id_fkey"[\s\S]{0,160}?isOneToOne: true/,
    );
    expect(generatedTypes).toMatch(
      /journal_ai_consents:[\s\S]{0,160}?Row:[\s\S]{0,80}?generation: number/,
    );
    expect(generatedTypes).toMatch(
      /grant_journal_ai_consent:[\s\S]{0,80}?Args: \{ p_expected_generation: number \}/,
    );
  });

  it("repairs a partially applied production migration without deleting journal media", () => {
    const sql = readMediaConstraintRepairMigration();

    expect(sql).toMatch(/Journal photo integrity repair preflight failed/i);
    expect(sql).toMatch(/Journal audio integrity repair preflight failed/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.journal_(photos|audio)/i);
    expect(sql).toMatch(
      /alter table public\.journal_photos[\s\S]*foreign key \(entry_id\)[\s\S]*references public\.journal_entries\(id\)[\s\S]*on delete cascade/i,
    );
    expect(sql).toMatch(
      /alter table public\.journal_audio[\s\S]*foreign key \(entry_id\)[\s\S]*references public\.journal_entries\(id\)[\s\S]*on delete cascade/i,
    );
    expect(sql).toMatch(/validate constraint journal_photos_entry_id_fkey/i);
    expect(sql).toMatch(/validate constraint journal_audio_entry_id_fkey/i);
  });

  it("rejects stale updates and exposes a least-privilege replay check", () => {
    const sql = readIntegrityMigration();

    expect(sql).toMatch(/function\s+public\.reject_stale_journal_entry_update\s*\(/i);
    expect(sql).toMatch(/before update\s+on public\.journal_entries/i);
    expect(sql).toMatch(/new\.updated_at\s*<=\s*old\.updated_at/i);
    expect(sql).toMatch(/return null/i);
    expect(sql).toMatch(/function\s+public\.is_journal_entry_payload_current\s*\(/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path\s*=\s*''/i);
    expect(sql).toMatch(/revoke execute on function public\.is_journal_entry_payload_current\(jsonb\)\s+from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.is_journal_entry_payload_current\(jsonb\)\s+to authenticated/i);
  });
});
