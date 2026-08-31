import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260813000000_atomic_manual_sync_event.sql",
);

const readRepositoryFile = (relativePath: string): string =>
  readFileSync(resolve(repositoryRoot, relativePath), "utf8");

describe("manual sync acceptance contract", () => {
  it("keeps an idempotent manual target mutation and its ordered event in one owner transaction", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.commit_manual_sync_event\s*\(\s*p_request\s+jsonb\s*\)/i,
    );
    expect(sql).toContain("(SELECT auth.uid())");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("pg_catalog.hashtextextended(v_owner::text, 2101)");
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.update_moods_updated_at_for_accepted_write()",
    );
    expect(sql).toContain(
      "pg_catalog.current_setting('zenflow.automation_internal', true)",
    );
    expect(sql).toMatch(
      /drop\s+trigger\s+if\s+exists\s+update_moods_updated_at\s+on\s+public\.moods/i,
    );
    expect(sql).toContain("event.idempotency_key = v_operation_id");
    expect(sql).toContain("MANUAL_SYNC_IDEMPOTENCY_MISMATCH");
    expect(sql).toContain("MANUAL_SYNC_OWNER_CONFLICT");
    expect(sql.match(/GET DIAGNOSTICS v_written_count = ROW_COUNT;/g)).toHaveLength(4);
    expect(sql).toContain("pg_catalog.set_config('zenflow.automation_transaction_id', '', true)");
    expect(sql).toContain("WHEN 'mood' THEN");
    expect(sql).toContain("WHEN 'journal' THEN");
    expect(sql).toContain("WHEN 'habit_completion' THEN");
    expect(sql).toContain("WHEN 'setting' THEN");
    expect(sql).toContain("WHEN 'focus' THEN");
    expect(sql).toMatch(/insert\s+into\s+public\.sync_events/i);
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.commit_manual_sync_event\(jsonb\)\s+from\s+public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.commit_manual_sync_event\(jsonb\)\s+to\s+authenticated/i,
    );
  });

  it("routes every T170 manual source or target delivery through the atomic receipt", () => {
    const helper = readRepositoryFile("src/storage/sync/manualSyncAcceptance.ts");
    const mood = readRepositoryFile("src/storage/sync/syncMoods.ts");
    const habit = readRepositoryFile("src/storage/sync/syncHabits.ts");
    const focus = readRepositoryFile("src/storage/sync/syncFocus.ts");
    const journal = readRepositoryFile("src/storage/sync/syncJournal.ts");
    const setting = readRepositoryFile("src/storage/sync/syncSettings.ts");

    expect(helper).toContain('rpc("commit_manual_sync_event"');
    for (const source of [mood, habit, focus, journal, setting]) {
      expect(source).toContain("commitManualSyncEvent");
    }

    expect(readRepositoryFile("src/types/supabase.ts")).toContain(
      "commit_manual_sync_event: { Args: { p_request: Json }; Returns: Json }",
    );
  });
});
